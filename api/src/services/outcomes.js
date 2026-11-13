import { randomUUID } from "node:crypto";
import { transaction, lock, audit } from "../db.js";
import { fail, cents, text } from "../validation.js";
import { reconcile } from "./commission.js";
import { queueMeta } from "./metaCapi.js";
import { enqueue, publicLink } from "./queue.js";
export async function recordOutcome(id, body, actor) {
  return transaction(async (c) => {
    let a = (await c.query("SELECT * FROM appointments WHERE id=$1", [id]))
      .rows[0];
    if (a) {
      await lock(c, "lead:" + a.lead_id);
      await lock(c, "partner:" + a.partner_id);
    }
    await lock(c, "appointment:" + id);
    a = (
      await c.query("SELECT * FROM appointments WHERE id=$1 FOR UPDATE", [id])
    ).rows[0];
    if (!a || (actor.role !== "admin" && a.partner_id !== actor.partner_id))
      fail("Appointment not found.", 404);
    if (actor.role === "admin" && !text(body.reason))
      fail("An override reason is required.");
    const lead = (await c.query("SELECT * FROM leads WHERE id=$1", [a.lead_id]))
        .rows[0],
      p = (await c.query("SELECT * FROM partners WHERE id=$1", [a.partner_id]))
        .rows[0];
    let o = (
      await c.query("SELECT * FROM outcomes WHERE appointment_id=$1", [id])
    ).rows[0];
    if (body.status) {
      if (
        !["booked", "rescheduled", "canceled", "showed", "no_show"].includes(
          body.status,
        )
      )
        fail("Invalid appointment status.");
      if (
        actor.role !== "admin" &&
        !["showed", "no_show"].includes(body.status)
      )
        fail("Status override requires an admin.", 403);
      if (["booked", "rescheduled"].includes(body.status)) {
        await lock(c, "partner:" + a.partner_id);
        const conflict = (
          await c.query(
            "SELECT id FROM appointments WHERE partner_id=$1 AND id<>$2 AND status IN ('booked','rescheduled') AND starts_at<$4 AND ends_at>$3",
            [a.partner_id, a.id, a.starts_at, a.ends_at],
          )
        ).rows[0];
        if (conflict) fail("Appointment overlaps an existing booking.", 409);
      }
      a = (
        await c.query(
          "UPDATE appointments SET status=$2,updated_at=now() WHERE id=$1 RETURNING *",
          [id, body.status],
        )
      ).rows[0];
      if (body.status === "no_show" && !a.no_show_offer_sent_at)
        await enqueue(
          c,
          "no-show-" + id,
          "sms",
          lead.phone_e164,
          `Missed your turf estimate? You can choose another time here: ${publicLink("/turf/book.html?t=" + lead.booking_token)}`,
          {
            leadId: lead.id,
            timezone: p.timezone,
            consent: true,
            category: "no_show",
            appointmentId: id,
            revision: a.revision,
            stamp: "no_show_offer_sent_at",
          },
        );
      await audit(c, "appointment", id, "status_changed", {
        status: body.status,
        actor: actor.role,
        reason: text(body.reason),
      });
    }
    if (body.result) {
      if (!["sold", "lost"].includes(body.result)) fail("Choose sold or lost.");
      const value = body.result === "sold" ? cents(body.job_value_cents) : null;
      if (body.result === "sold" && value <= 0)
        fail("Sold jobs require a positive dollar value.");
      const lost = body.result === "lost" ? text(body.lost_reason) : null;
      if (
        body.result === "lost" &&
        ![
          "price",
          "went_with_someone_else",
          "not_ready",
          "bad_lead",
          "other",
        ].includes(lost)
      )
        fail("Choose a lost reason.");
      let deposit = body.deposit_paid_at || null;
      if (deposit && !Number.isFinite(+new Date(deposit)))
        fail("Enter a valid deposit-paid date.");
      if (deposit && +new Date(deposit) > Date.now())
        fail("Deposit-paid date cannot be in the future.");
      o = (
        await c.query(
          "INSERT INTO outcomes(id,appointment_id,result,job_value_cents,deposit_paid_at,lost_reason,recorded_by) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(appointment_id) DO UPDATE SET result=excluded.result,job_value_cents=excluded.job_value_cents,deposit_paid_at=excluded.deposit_paid_at,lost_reason=excluded.lost_reason,recorded_by=excluded.recorded_by,recorded_at=now() RETURNING *",
          [
            o?.id || randomUUID(),
            id,
            body.result,
            value,
            body.result === "sold" ? deposit : null,
            lost,
            actor.role + ":" + (actor.partner_id || "owner"),
          ],
        )
      ).rows[0];
      await audit(c, "outcome", o.id, "recorded", {
        result: o.result,
        job_value_cents: o.job_value_cents,
        deposit_paid_at: o.deposit_paid_at,
        lost_reason: o.lost_reason,
        actor: actor.role,
        reason: text(body.reason),
      });
      if (o.result === "sold")
        await queueMeta(c, "Purchase", id, lead, {
          value: value / 100,
          currency: "USD",
        });
    }
    await reconcile(c, a, o);
    return { ok: true, appointment: a, outcome: o };
  });
}
