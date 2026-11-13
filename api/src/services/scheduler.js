import { DateTime } from "luxon";
import { transaction, query, audit, lock } from "../db.js";
import { enqueue, publicLink, adminAlert } from "./queue.js";
import { driver as smsDriver, nextSmsTime, canSend } from "./sms.js";
import { driver as emailDriver } from "./email.js";
import { sendMeta } from "./metaCapi.js";
export function followupDue(lead, zone) {
  const t = DateTime.fromJSDate(new Date(lead.created_at), { zone });
  return [
    {
      key: "1h",
      at: t.plus({ hours: 1 }).toJSDate(),
      stamp: "followup_1h_sent_at",
    },
    {
      key: "day1",
      at: t.plus({ days: 1 }).startOf("day").set({ hour: 10 }).toJSDate(),
      stamp: "followup_day1_sent_at",
    },
    {
      key: "day3",
      at: t.plus({ days: 3 }).startOf("day").set({ hour: 10 }).toJSDate(),
      stamp: "followup_day3_sent_at",
    },
  ];
}
export function reminderDue(a, now) {
  const ms = +new Date(a.starts_at) - +new Date(now);
  if (ms <= 0 || !["booked", "rescheduled"].includes(a.status)) return [];
  const out = [];
  if (ms <= 24 * 3600000 && ms > 2 * 3600000 && !a.reminder_24h_sent_at)
    out.push("24h");
  if (ms <= 2 * 3600000 && !a.reminder_2h_sent_at) out.push("2h");
  return out;
}
export async function schedule(now = new Date()) {
  await transaction(async (c) => {
    await lock(c, "scheduler");
    const leads = (
      await c.query(
        "SELECT l.*,p.timezone,p.business_name FROM leads l JOIN partners p ON p.id=l.partner_id WHERE l.status IN ('new','contacted') AND l.opted_out_at IS NULL AND l.replied_at IS NULL AND p.status='active'",
      )
    ).rows;
    for (const l of leads) {
      if (+now - +new Date(l.created_at) >= 7 * 86400000) {
        await c.query("UPDATE leads SET status='dead' WHERE id=$1", [l.id]);
        await c.query(
          "UPDATE messages SET status='canceled' WHERE lead_id=$1 AND status='queued' AND payload->>'category'='followup'",
          [l.id],
        );
        await audit(c, "lead", l.id, "sequence_expired");
        continue;
      }
      const due = followupDue(l, l.timezone).filter(
        (d) => +d.at <= +now && !l[d.stamp],
      );
      if (!due.length) continue;
      const d = due.at(-1),
        link = publicLink("/turf/book.html?t=" + l.booking_token);
      const body =
        d.key === "1h"
          ? `Still want that turf estimate, ${l.first_name}? Here's the link again: ${link}`
          : d.key === "day1"
            ? `Quick one, ${l.first_name}. Most of our installer's estimate slots this week are filling. Want me to hold one? ${link}`
            : `Last check-in, ${l.first_name}. You can book your free turf estimate here whenever you're ready: ${link}`;
      // Supersede stale nudges after downtime rather than sending a burst of all missed steps.
      for (const old of due.slice(0, -1)) {
        await c.query(`UPDATE leads SET ${old.stamp}=$2 WHERE id=$1`, [
          l.id,
          now,
        ]);
        await c.query(
          "UPDATE messages SET status='canceled' WHERE delivery_key=$1 AND status='queued'",
          ["followup-" + l.id + "-" + old.key],
        );
        await audit(c, "lead", l.id, "followup_skipped", { step: old.key });
      }
      await enqueue(
        c,
        "followup-" + l.id + "-" + d.key,
        "sms",
        l.phone_e164,
        body,
        {
          leadId: l.id,
          timezone: l.timezone,
          consent: true,
          category: "followup",
          stamp: d.stamp,
        },
      );
    }
    const appts = (
      await c.query(
        "SELECT a.*,l.booking_token,l.phone_e164,l.opted_out_at,p.business_name,p.timezone FROM appointments a JOIN leads l ON l.id=a.lead_id JOIN partners p ON p.id=a.partner_id WHERE a.status IN ('booked','rescheduled') AND a.starts_at>$1 AND l.opted_out_at IS NULL",
        [now],
      )
    ).rows;
    for (const a of appts)
      for (const kind of reminderDue(a, now)) {
        const t = DateTime.fromJSDate(new Date(a.starts_at), {
            zone: a.timezone,
          }),
          body =
            kind === "24h"
              ? `Reminder: ${a.business_name} is coming out ${t.toFormat("ccc, LLL d")} at ${t.toFormat("h:mm a")} for your turf estimate. Reply C to confirm or R to reschedule.`
              : `${a.business_name} will be there at ${t.toFormat("h:mm a")}. See you soon.`;
        await enqueue(
          c,
          `reminder-${a.id}-${a.revision}-${kind}`,
          "sms",
          a.phone_e164,
          body,
          {
            leadId: a.lead_id,
            timezone: a.timezone,
            consent: true,
            category: "reminder",
            appointmentId: a.id,
            revision: a.revision,
            stamp:
              kind === "24h" ? "reminder_24h_sent_at" : "reminder_2h_sent_at",
          },
        );
      }
  });
}
export async function deliver(
  now = new Date(),
  { sms = smsDriver, email = emailDriver, meta = sendMeta, limit = 100 } = {},
) {
  let handled = 0;
  const due = (
    await query(
      "SELECT id FROM messages WHERE status='queued' AND due_at<=$1 ORDER BY due_at LIMIT $2",
      [now, limit],
    )
  ).rows;
  for (const item of due)
    await transaction(async (c) => {
      let m = (await c.query("SELECT * FROM messages WHERE id=$1", [item.id]))
        .rows[0];
      if (m.lead_id) await lock(c, "lead:" + m.lead_id);
      m = (
        await c.query(
          "SELECT * FROM messages WHERE id=$1 AND status='queued' AND due_at<=$2 FOR UPDATE SKIP LOCKED",
          [item.id, now],
        )
      ).rows[0];
      if (!m) return;
      const payload = m.payload,
        lead = m.lead_id
          ? (await c.query("SELECT * FROM leads WHERE id=$1", [m.lead_id]))
              .rows[0]
          : null;
      if (m.channel === "sms") {
        const suppressed = (
          await c.query("SELECT * FROM sms_suppressions WHERE phone_e164=$1", [
            m.recipient,
          ])
        ).rows[0];
        let blocked = !canSend({
          consent: payload.consent,
          opted_out_at: lead?.opted_out_at,
          suppressed,
        });
        if (payload.category === "holding" && lead?.status !== "unassigned")
          blocked = true;
        if (payload.category === "welcome" && lead?.status === "booked")
          blocked = true;
        if (
          payload.category === "followup" &&
          (!lead ||
            !["new", "contacted"].includes(lead.status) ||
            lead.replied_at)
        )
          blocked = true;
        if (payload.appointmentId) {
          const a = (
            await c.query("SELECT * FROM appointments WHERE id=$1", [
              payload.appointmentId,
            ])
          ).rows[0];
          if (!a || a.revision !== payload.revision) blocked = true;
          if (
            payload.category === "reminder" &&
            (!["booked", "rescheduled"].includes(a?.status) ||
              +new Date(a.starts_at) <= +now)
          )
            blocked = true;
        }
        if (blocked) {
          await c.query("UPDATE messages SET status='canceled' WHERE id=$1", [
            m.id,
          ]);
          await audit(c, "message", m.id, "suppressed");
          return;
        }
        let when;
        try {
          when = nextSmsTime(now, payload.timezone);
        } catch {
          await c.query(
            "UPDATE messages SET status='failed',last_error='missing_timezone' WHERE id=$1",
            [m.id],
          );
          await audit(c, "message", m.id, "invalid_timezone");
          await enqueue(
            c,
            "timezone-failure-" + m.id,
            "email",
            process.env.ALERT_EMAIL,
            "A queued SMS needs a valid recipient timezone. Message reference: " +
              m.id,
            { category: "failure_alert", subject: "SMS timezone required" },
          );
          return;
        }
        if (+when > +now) {
          await c.query("UPDATE messages SET due_at=$2 WHERE id=$1", [
            m.id,
            when,
          ]);
          return;
        }
      }
      try {
        const result =
          m.channel === "sms"
            ? await sms.send({ to: m.recipient, body: m.body })
            : m.channel === "email"
              ? await email.send({ to: m.recipient, body: m.body, ...payload })
              : await meta(payload);
        await c.query(
          "UPDATE messages SET status=$2,provider_id=$3,sent_at=$4,attempts=attempts+1 WHERE id=$1",
          [m.id, result.logged ? "logged" : "sent", result.id || null, now],
        );
        if (payload.stamp) {
          const allowed = [
            "followup_1h_sent_at",
            "followup_day1_sent_at",
            "followup_day3_sent_at",
            "reminder_24h_sent_at",
            "reminder_2h_sent_at",
            "no_show_offer_sent_at",
          ];
          if (!allowed.includes(payload.stamp)) throw Error("Unknown stamp");
          await c.query(
            `UPDATE ${payload.appointmentId ? "appointments" : "leads"} SET ${payload.stamp}=$2 WHERE id=$1`,
            [payload.appointmentId || m.lead_id, now],
          );
        }
        if (payload.category === "welcome") {
          await c.query(
            "UPDATE leads SET last_contacted_at=$2,status=CASE WHEN status='new' THEN 'contacted' ELSE status END WHERE id=$1",
            [m.lead_id, now],
          );
          await audit(c, "lead", m.lead_id, "contacted", {
            simulated: !!result.logged,
          });
        }
        await audit(c, "message", m.id, result.logged ? "logged" : "sent", {
          channel: m.channel,
        });
        handled++;
      } catch (e) {
        const tries = m.attempts + 1;
        await c.query(
          "UPDATE messages SET attempts=$2,status=$3,due_at=$4,last_error=$5 WHERE id=$1",
          [
            m.id,
            tries,
            tries >= 3 ? "failed" : "queued",
            new Date(+now + [60000, 300000, 900000][Math.min(tries - 1, 2)]),
            String(e.code || e.name || "provider_failure"),
          ],
        );
        await audit(c, "message", m.id, "delivery_failed", { attempt: tries });
        if (tries === 3 && payload.category !== "failure_alert")
          await enqueue(
            c,
            "failure-" + m.id,
            "email",
            process.env.ALERT_EMAIL,
            `A ${m.channel} delivery failed after three attempts. Message reference: ${m.id}. Check the pipeline dashboard.`,
            { category: "failure_alert", subject: "Pipeline delivery failure" },
          );
      }
    });
  return handled;
}
export async function tick(now = new Date(), drivers) {
  await schedule(now);
  return deliver(now, drivers);
}
