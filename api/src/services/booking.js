import { randomUUID } from "node:crypto";
import { DateTime } from "luxon";
import { transaction, lock, audit, query } from "../db.js";
import { fail, text } from "../validation.js";
import { generateSlots, calendarFile } from "./calendar.js";
import { enqueue, publicLink, apiLink } from "./queue.js";
import { partnerAlert } from "./notifications.js";
import { queueMeta } from "./metaCapi.js";
export async function bookingContext(c, token) {
  if (!/^[a-f0-9]{64}$/.test(token)) fail("Booking link not found.", 404);
  const lead = (
    await c.query("SELECT * FROM leads WHERE booking_token=$1", [token])
  ).rows[0];
  if (!lead) fail("Booking link not found.", 404);
  const prior = (
    await c.query(
      "SELECT * FROM appointments WHERE lead_id=$1 ORDER BY created_at DESC LIMIT 1",
      [lead.id],
    )
  ).rows[0];
  const partner = (
    await c.query("SELECT * FROM partners WHERE id=$1", [
      prior?.partner_id || lead.partner_id,
    ])
  ).rows[0];
  return { lead, partner, prior };
}
export async function slots(c, p, now = new Date(), exclude = null) {
  const windows = (
      await c.query("SELECT * FROM availability WHERE partner_id=$1", [p.id])
    ).rows,
    blackouts = (
      await c.query("SELECT * FROM blackouts WHERE partner_id=$1", [p.id])
    ).rows,
    appointments = (
      await c.query(
        "SELECT * FROM appointments WHERE partner_id=$1 AND status IN ('booked','rescheduled')",
        [p.id],
      )
    ).rows.filter((a) => a.id !== exclude);
  return generateSlots(p, windows, blackouts, appointments, now);
}
export async function bookingView(token) {
  const { lead, partner, prior } = await bookingContext({ query }, token);
  if (!partner)
    return {
      pending: true,
      message:
        "We're matching you with an installer in your area. We'll be in touch shortly.",
    };
  return {
    partner_name: partner.business_name,
    timezone: partner.timezone,
    appointment_minutes: partner.appointment_minutes,
    slots:
      partner.status === "active"
        ? await slots({ query }, partner, new Date(), prior?.id)
        : [],
    appointment: prior
      ? {
          starts_at: prior.starts_at,
          ends_at: prior.ends_at,
          status: prior.status,
          install_address: prior.install_address,
        }
      : null,
    first_name: lead.first_name,
  };
}
export async function bookingNotify(c, lead, p, a, action) {
  const when = DateTime.fromJSDate(new Date(a.starts_at), {
      zone: p.timezone,
    }).toFormat("ccc, LLL d, h:mm a ZZZZ"),
    link = publicLink("/turf/book.html?t=" + lead.booking_token),
    ics = apiLink("/api/booking/" + lead.booking_token + "/calendar.ics");
  const body =
    action === "canceled"
      ? `Your turf estimate with ${p.business_name} has been canceled. Choose another time: ${link}`
      : `Your free turf estimate with ${p.business_name} is ${when}. Reschedule or cancel: ${link}. Calendar: ${ics}`;
  const key = "booking-" + a.id + "-" + a.revision + "-" + action;
  await enqueue(c, key + "-sms", "sms", lead.phone_e164, body, {
    leadId: lead.id,
    timezone: p.timezone,
    consent: true,
    category: "booking",
    appointmentId: a.id,
    revision: a.revision,
  });
  await enqueue(c, key + "-email", "email", lead.email, body, {
    leadId: lead.id,
    subject: "Your turf estimate " + action,
  });
  await partnerAlert(
    c,
    key + "-partner",
    p,
    lead,
    `${lead.first_name} ${lead.last_name}: ${action}\n${when}\n${a.install_address}\n${lead.phone_e164}\n${apiLink("/partner")}`,
  );
}
export async function book(token, body, now = new Date()) {
  return transaction(async (c) => {
    let { lead, partner: p, prior } = await bookingContext(c, token);
    await lock(c, "lead:" + lead.id);
    ({ lead, partner: p, prior } = await bookingContext(c, token));
    if (!p || p.status !== "active")
      fail("An installer is not available yet.", 409);
    await lock(c, "partner:" + p.id);
    if (
      !["booked", "rescheduled", "canceled", "no_show"].includes(
        prior?.status || "booked",
      )
    )
      fail("Contact your installer to change this appointment.", 409);
    const wanted = new Date(body.starts_at);
    if (!Number.isFinite(+wanted)) fail("Choose a valid appointment.");
    if (
      prior &&
      ["booked", "rescheduled"].includes(prior.status) &&
      +new Date(prior.starts_at) === +wanted
    )
      return { ok: true, appointment: prior };
    const address = text(body.install_address, 500);
    if (address.length < 5) fail("Enter the install address.");
    const available = await slots(c, p, now, prior?.id);
    if (!available.some((s) => +new Date(s) === +wanted))
      fail("That time is no longer available. Choose another.", 409);
    let a;
    if (prior) {
      a = (
        await c.query(
          "UPDATE appointments SET starts_at=$2,ends_at=$3,install_address=$4,status='rescheduled',revision=revision+1,reminder_24h_sent_at=NULL,reminder_2h_sent_at=NULL,confirmed_at=NULL,updated_at=now() WHERE id=$1 RETURNING *",
          [
            prior.id,
            wanted,
            new Date(+wanted + p.appointment_minutes * 60000),
            address,
          ],
        )
      ).rows[0];
      await c.query(
        "UPDATE messages SET status='canceled' WHERE lead_id=$1 AND status='queued' AND payload->>'category' IN ('reminder','booking')",
        [lead.id],
      );
    } else {
      a = (
        await c.query(
          "INSERT INTO appointments(id,lead_id,partner_id,starts_at,ends_at,install_address,status,commission_pct,per_show_fee_cents) VALUES($1,$2,$3,$4,$5,$6,'booked',$7,$8) RETURNING *",
          [
            randomUUID(),
            lead.id,
            p.id,
            wanted,
            new Date(+wanted + p.appointment_minutes * 60000),
            address,
            p.commission_pct,
            p.per_show_fee_cents,
          ],
        )
      ).rows[0];
    }
    await c.query("UPDATE leads SET status='booked' WHERE id=$1", [lead.id]);
    await audit(c, "appointment", a.id, prior ? "rescheduled" : "booked", {
      starts_at: a.starts_at,
      partner_id: a.partner_id,
      revision: a.revision,
    });
    await bookingNotify(c, lead, p, a, prior ? "rescheduled" : "booked");
    await queueMeta(c, "Schedule", a.id, lead);
    return { ok: true, appointment: a };
  });
}
export async function cancel(token) {
  return transaction(async (c) => {
    const { lead, partner: p, prior } = await bookingContext(c, token);
    await lock(c, "lead:" + lead.id);
    if (!prior) return { ok: true };
    await lock(c, "partner:" + p.id);
    const a = (
      await c.query(
        "UPDATE appointments SET status='canceled',revision=revision+1,updated_at=now() WHERE id=$1 AND status IN ('booked','rescheduled') RETURNING *",
        [prior.id],
      )
    ).rows[0];
    if (!a) return { ok: true };
    await c.query("UPDATE leads SET status='dead' WHERE id=$1", [lead.id]);
    await c.query(
      "UPDATE messages SET status='canceled' WHERE lead_id=$1 AND status='queued' AND payload->>'category' IN ('reminder','booking','followup')",
      [lead.id],
    );
    await audit(c, "appointment", a.id, "canceled");
    await bookingNotify(c, lead, p, a, "canceled");
    return { ok: true };
  });
}
export async function ics(token) {
  const { prior, partner: p } = await bookingContext({ query }, token);
  if (!prior) fail("No appointment found.", 404);
  return calendarFile(prior, p);
}
