import { DateTime } from "luxon";
import { Router } from "express";
import { randomUUID } from "node:crypto";
import { query, transaction, lock, audit } from "../db.js";
import { text, fail } from "../validation.js";
import { auth, magic, verifyMagic, session } from "../services/auth.js";
import { enqueue, apiLink } from "../services/queue.js";
import { recordOutcome } from "../services/outcomes.js";
export const partner = Router();
partner.post("/login", async (req, res) => {
  const email = text(req.body.email, 254).toLowerCase();
  await transaction(async (c) => {
    await lock(c, "login:" + email);
    const last = (
      await c.query("SELECT * FROM auth_requests WHERE subject=$1", [email])
    ).rows[0];
    if (last && Date.now() - +new Date(last.requested_at) < 60000) return;
    await c.query(
      "INSERT INTO auth_requests VALUES($1,now()) ON CONFLICT(subject) DO UPDATE SET requested_at=now()",
      [email],
    );
    const p = (
      await c.query(
        "SELECT * FROM partners WHERE lower(owner_email)=$1 AND status='active'",
        [email],
      )
    ).rows[0];
    if (!p) return;
    const link = apiLink("/partner#magic=" + magic(p.id));
    await enqueue(
      c,
      "magic-" + randomUUID(),
      "email",
      p.owner_email,
      "Sign in to your Local Insider partner portal. This link is valid for seven days: " +
        link,
      { subject: "Your partner sign-in link" },
    );
  });
  res.json({
    ok: true,
    message: "If this email is registered, a sign-in link is on its way.",
  });
});
partner.post("/session", async (req, res) => {
  const data = verifyMagic(req.body.token),
    p = (
      await query("SELECT id FROM partners WHERE id=$1 AND status='active'", [
        data.id,
      ])
    ).rows[0];
  if (!p) fail("Invalid sign-in link.", 401);
  res.json({ token: await session("partner", p.id) });
});
partner.use(auth("partner"));
partner.get("/data", async (req, res) => {
  const id = req.auth.partner_id,
    p = (
      await query(
        "SELECT id,business_name,timezone,appointment_minutes,commission_pct,per_show_fee_cents FROM partners WHERE id=$1",
        [id],
      )
    ).rows[0],
    leads = (
      await query(
        "SELECT id,first_name,last_name,phone_e164,email,zip,yard_size,current_surface,project_scope,timeline,created_at,status FROM leads WHERE partner_id=$1 AND status IN ('new','contacted') ORDER BY created_at DESC",
        [id],
      )
    ).rows,
    appointments = (
      await query(
        "SELECT a.*,l.first_name,l.last_name,l.phone_e164,o.result,o.job_value_cents,o.deposit_paid_at,o.lost_reason FROM appointments a JOIN leads l ON l.id=a.lead_id LEFT JOIN outcomes o ON o.appointment_id=a.id WHERE a.partner_id=$1 ORDER BY a.starts_at DESC",
        [id],
      )
    ).rows,
    availability = (
      await query(
        "SELECT * FROM availability WHERE partner_id=$1 ORDER BY weekday,start_time",
        [id],
      )
    ).rows,
    blackouts = (
      await query(
        "SELECT * FROM blackouts WHERE partner_id=$1 ORDER BY starts_at",
        [id],
      )
    ).rows,
    ledger = (
      await query(
        "SELECT kind,sum(amount_cents) AS earned,sum(CASE WHEN paid_at IS NULL THEN amount_cents ELSE 0 END) AS owed FROM ledger WHERE partner_id=$1 AND earned_at>=date_trunc('month',now()) GROUP BY kind",
        [id],
      )
    ).rows;
  res.json({
    partner: p,
    leads,
    appointments,
    availability,
    blackouts,
    ledger,
  });
});
partner.post("/appointments/:id/outcome", async (req, res) =>
  res.json(
    await recordOutcome(req.params.id, req.body, {
      role: "partner",
      partner_id: req.auth.partner_id,
    }),
  ),
);
export async function saveAvailability(partnerId, body) {
  return transaction(async (c) => {
    await lock(c, "partner:" + partnerId);
    const owner = (
      await c.query("SELECT timezone FROM partners WHERE id=$1", [partnerId])
    ).rows[0];
    const windows = body.windows,
      blocks = Array.isArray(body.blackouts)
        ? body.blackouts.map((b) => ({
            starts_at: DateTime.fromISO(String(b.starts_at), {
              zone: owner.timezone,
            })
              .toUTC()
              .toISO(),
            ends_at: DateTime.fromISO(String(b.ends_at), {
              zone: owner.timezone,
            })
              .toUTC()
              .toISO(),
          }))
        : body.blackouts;
    if (
      !Array.isArray(windows) ||
      windows.length > 50 ||
      !Array.isArray(blocks) ||
      blocks.length > 100
    )
      fail("Invalid availability.");
    for (const w of windows) {
      if (
        !Number.isInteger(w.weekday) ||
        w.weekday < 0 ||
        w.weekday > 6 ||
        !/^([01]\d|2[0-3]):[0-5]\d$/.test(w.start_time) ||
        !/^([01]\d|2[0-3]):[0-5]\d$/.test(w.end_time) ||
        w.start_time >= w.end_time
      )
        fail("Check weekly hours.");
    }
    for (const b of blocks) {
      if (
        !b.starts_at ||
        !b.ends_at ||
        !Number.isFinite(+new Date(b.starts_at)) ||
        !Number.isFinite(+new Date(b.ends_at)) ||
        +new Date(b.starts_at) >= +new Date(b.ends_at)
      )
        fail("Check blackout dates.");
      const conflict = (
        await c.query(
          "SELECT id FROM appointments WHERE partner_id=$1 AND status IN ('booked','rescheduled') AND starts_at<$3 AND ends_at>$2",
          [partnerId, b.starts_at, b.ends_at],
        )
      ).rows[0];
      if (conflict)
        fail(
          "A blackout overlaps a booked appointment. Reschedule it first.",
          409,
        );
    }
    await c.query("DELETE FROM availability WHERE partner_id=$1", [partnerId]);
    await c.query("DELETE FROM blackouts WHERE partner_id=$1", [partnerId]);
    for (const w of windows)
      await c.query("INSERT INTO availability VALUES($1,$2,$3,$4,$5)", [
        randomUUID(),
        partnerId,
        w.weekday,
        w.start_time,
        w.end_time,
      ]);
    for (const b of blocks)
      await c.query("INSERT INTO blackouts VALUES($1,$2,$3,$4)", [
        randomUUID(),
        partnerId,
        b.starts_at,
        b.ends_at,
      ]);
    await audit(c, "partner", partnerId, "availability_changed", {
      windows,
      blackouts: blocks,
    });
    return { ok: true };
  });
}
partner.put("/availability", async (req, res) =>
  res.json(await saveAvailability(req.auth.partner_id, req.body)),
);
