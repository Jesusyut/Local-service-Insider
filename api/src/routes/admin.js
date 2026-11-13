import { Router } from "express";
import { randomUUID } from "node:crypto";
import { DateTime } from "luxon";
import { query, transaction, lock, audit } from "../db.js";
import { auth, adminLogin } from "../services/auth.js";
import { fail, text, cents, timezone, phone, uuid } from "../validation.js";
import { contactLead } from "../services/notifications.js";
import { recordOutcome } from "../services/outcomes.js";
import { csv, invoicePdf } from "../services/reports.js";
export const admin = Router();
admin.post("/login", async (req, res) =>
  res.json({ token: await adminLogin(req.body.password) }),
);
admin.use(auth("admin"));
const validEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
export async function savePartner(body, id = null) {
  const p = {
    business_name: text(body.business_name, 200),
    owner_name: text(body.owner_name, 100),
    owner_email: text(body.owner_email, 254).toLowerCase(),
    owner_phone: body.owner_phone ? phone(body.owner_phone) : null,
    timezone: timezone(body.timezone),
    commission_pct: Number(body.commission_pct),
    per_show_fee_cents: cents(body.per_show_fee_cents || 0),
    min_job_value_cents: cents(body.min_job_value_cents || 0),
    appointment_minutes: Number(body.appointment_minutes || 60),
    status: body.status,
    notify_phones: Array.isArray(body.notify_phones)
      ? body.notify_phones.map(phone)
      : [],
    notify_emails: Array.isArray(body.notify_emails)
      ? body.notify_emails.map((e) => text(e, 254).toLowerCase())
      : [],
  };
  if (
    !p.business_name ||
    !p.owner_name ||
    !validEmail(p.owner_email) ||
    p.notify_emails.some((e) => !validEmail(e)) ||
    p.notify_phones.length > 10 ||
    p.notify_emails.length > 10 ||
    !Number.isFinite(p.commission_pct) ||
    p.commission_pct < 0 ||
    p.commission_pct > 100 ||
    !Number.isInteger(p.appointment_minutes) ||
    p.appointment_minutes < 15 ||
    p.appointment_minutes > 480 ||
    !["active", "paused", "churned"].includes(p.status)
  )
    fail("Check partner fields, email and terms.");
  if (p.owner_phone || p.notify_phones.length) {
    if (body.notifications_consent !== true)
      fail("Confirm the partner agreed to operational SMS notifications.");
    p.notifications_consent_at = new Date();
  }
  return transaction(async (c) => {
    const key = id || randomUUID();
    await lock(c, "partner:" + key);
    if (id) {
      if (
        !(await c.query("SELECT id FROM partners WHERE id=$1", [id])).rows
          .length
      )
        fail("Partner not found.", 404);
      const columns = Object.keys(p);
      await c.query(
        `UPDATE partners SET ${columns.map((k, i) => k + "=$" + (i + 2)).join(",")} WHERE id=$1`,
        [id, ...Object.values(p)],
      );
    } else {
      const keys = ["id", ...Object.keys(p)];
      await c.query(
        `INSERT INTO partners(${keys}) VALUES(${keys.map((_, i) => "$" + (i + 1))})`,
        [key, ...Object.values(p)],
      );
    }
    await audit(c, "partner", key, id ? "updated" : "created", {
      ...p,
      reason: text(body.reason),
    });
    return { ok: true, id: key };
  });
}
admin.post("/partners", async (req, res) =>
  res.json(await savePartner(req.body)),
);
admin.put("/partners/:id", async (req, res) =>
  res.json(await savePartner(req.body, req.params.id)),
);
export async function assignTerritories(partnerId, input) {
  const zips = [
    ...new Set(
      String(input || "")
        .split(/[\s,;]+/)
        .filter(Boolean),
    ),
  ].sort();
  if (
    !zips.length ||
    zips.length > 1000 ||
    zips.some((z) => !/^\d{5}$/.test(z))
  )
    fail("Paste valid five-digit ZIP codes.");
  return transaction(async (c) => {
    const target = (
      await c.query("SELECT * FROM partners WHERE id=$1", [partnerId])
    ).rows[0];
    if (!target) fail("Partner not found.", 404);
    for (const zip of zips) {
      await lock(c, "zip:" + zip);
      const current = (
        await c.query(
          "SELECT t.*,p.status,p.business_name FROM territories t JOIN partners p ON p.id=t.partner_id WHERE zip=$1",
          [zip],
        )
      ).rows[0];
      if (
        current &&
        current.partner_id !== partnerId &&
        current.status === "active"
      )
        fail(`ZIP ${zip} belongs to ${current.business_name}.`, 409);
      await c.query(
        "INSERT INTO territories(id,partner_id,zip) VALUES($1,$2,$3) ON CONFLICT(zip) DO UPDATE SET partner_id=excluded.partner_id",
        [randomUUID(), partnerId, zip],
      );
      await audit(c, "territory", zip, "assigned", {
        partner_id: partnerId,
        previous_partner_id: current?.partner_id || null,
      });
    }
    return { ok: true, count: zips.length };
  });
}
admin.post("/territories", async (req, res) =>
  res.json(await assignTerritories(req.body.partner_id, req.body.zips)),
);
admin.post("/assign", async (req, res) =>
  res.json(
    await transaction(async (c) => {
      await lock(c, "lead:" + req.body.lead_id);
      const l = (
          await c.query(
            "SELECT * FROM leads WHERE id=$1 AND status='unassigned' FOR UPDATE",
            [req.body.lead_id],
          )
        ).rows[0],
        p = (
          await c.query(
            "SELECT * FROM partners WHERE id=$1 AND status='active'",
            [req.body.partner_id],
          )
        ).rows[0];
      if (!l || !p) fail("Choose an unassigned lead and active partner.", 409);
      await c.query("UPDATE leads SET partner_id=$2,status='new' WHERE id=$1", [
        l.id,
        p.id,
      ]);
      await audit(c, "lead", l.id, "manually_assigned", { partner_id: p.id });
      if (!l.opted_out_at)
        await contactLead(c, { ...l, partner_id: p.id, status: "new" }, p);
      return { ok: true };
    }),
  ),
);
admin.get("/data", async (req, res) => {
  const partners = (
      await query("SELECT * FROM partners ORDER BY created_at DESC")
    ).rows,
    territories = (await query("SELECT * FROM territories ORDER BY zip")).rows,
    unassigned = (
      await query(
        "SELECT * FROM leads WHERE status='unassigned' ORDER BY created_at DESC LIMIT 1000",
      )
    ).rows,
    failures = (
      await query(
        "SELECT id,channel,status,attempts,last_error,created_at FROM messages WHERE status='failed' ORDER BY created_at DESC LIMIT 100",
      )
    ).rows,
    invoices = (
      await query("SELECT * FROM invoices ORDER BY created_at DESC LIMIT 100")
    ).rows;
  res.json({ partners, territories, unassigned, failures, invoices });
});
admin.get("/unassigned.csv", async (req, res) =>
  res
    .type("text/csv")
    .attachment("unassigned.csv")
    .send(
      csv(
        (
          await query(
            "SELECT id,created_at,first_name,last_name,phone_e164,email,zip,yard_size,current_surface,project_scope,timeline,utm_campaign,consent_at FROM leads WHERE status='unassigned' ORDER BY created_at",
          )
        ).rows,
      ),
    ),
);
function period(from, to) {
  const a = DateTime.fromISO(String(from), { zone: "UTC" }),
    b = DateTime.fromISO(String(to), { zone: "UTC" });
  if (!a.isValid || !b.isValid || a > b) fail("Choose a valid date range.");
  return [
    a.startOf("day").toJSDate(),
    b.plus({ days: 1 }).startOf("day").toJSDate(),
  ];
}
admin.get("/dashboard", async (req, res) => {
  const [from, to] = period(req.query.from, req.query.to),
    partnerId = req.query.partner_id || null,
    campaign = text(req.query.utm_campaign, 200) || null;
  if (partnerId && !uuid(partnerId)) fail("Invalid partner.");
  const l = (
    await query(
      "SELECT l.id,l.partner_id,l.status,a.id AS appointment_id,a.partner_id AS booked_partner_id,a.status AS appointment_status,o.result,o.job_value_cents FROM leads l LEFT JOIN appointments a ON a.lead_id=l.id LEFT JOIN outcomes o ON o.appointment_id=a.id WHERE l.created_at >= $1 AND l.created_at < $2 AND l.duplicate_of IS NULL AND ($3::text IS NULL OR l.utm_campaign=$3)",
      [from, to, campaign],
    )
  ).rows.filter(
    (r) => !partnerId || (r.booked_partner_id || r.partner_id) === partnerId,
  );
  const ids = l.map((r) => r.appointment_id).filter(Boolean),
    lines = ids.length
      ? (
          await query(
            "SELECT * FROM ledger WHERE appointment_id=ANY($1::uuid[])",
            [ids],
          )
        ).rows
      : [];
  const spend = (
    await query(
      "SELECT COALESCE(sum(amount_cents),0) AS total FROM ad_spend WHERE month>=date_trunc('month',$1::timestamptz)::date AND month< $2 AND ($3::uuid IS NULL OR partner_id=$3)",
      [from, to, partnerId],
    )
  ).rows[0];
  const counts = {
      leads: l.length,
      booked: l.filter((r) => r.appointment_id).length,
      showed: l.filter((r) => r.appointment_status === "showed").length,
      sold: l.filter((r) => r.result === "sold").length,
    },
    revenue = {
      sold_value_cents: l.reduce(
        (s, r) => s + (r.result === "sold" ? r.job_value_cents : 0),
        0,
      ),
      commission_cents: lines
        .filter((r) => r.kind === "commission")
        .reduce((s, r) => s + Number(r.amount_cents), 0),
      per_show_fee_cents: lines
        .filter((r) => r.kind === "per_show_fee")
        .reduce((s, r) => s + Number(r.amount_cents), 0),
    },
    adSpend = Number(spend.total),
    earned = revenue.commission_cents + revenue.per_show_fee_cents;
  res.json({
    counts,
    rates: {
      booked_per_lead: counts.leads ? counts.booked / counts.leads : 0,
      showed_per_booked: counts.booked ? counts.showed / counts.booked : 0,
      sold_per_showed: counts.showed ? counts.sold / counts.showed : 0,
    },
    revenue,
    ad_spend_cents: adSpend,
    cost_per_lead_cents: counts.leads ? adSpend / counts.leads : null,
    cost_per_booked_cents: counts.booked ? adSpend / counts.booked : null,
    cost_per_sold_cents: counts.sold ? adSpend / counts.sold : null,
    margin_cents: earned - adSpend,
    spend_note:
      "Spend is for whole months intersecting this date range. Campaign-filtered reports still use whole-partner monthly spend.",
  });
});
admin.post("/spend", async (req, res) => {
  if (
    !/^\d{4}-\d{2}-01$/.test(req.body.month) ||
    !DateTime.fromISO(req.body.month).isValid
  )
    fail("Use the first day of a valid month.");
  const amount = cents(req.body.amount_cents);
  await transaction(async (c) => {
    await c.query(
      "INSERT INTO ad_spend VALUES($1,$2,$3) ON CONFLICT(partner_id,month) DO UPDATE SET amount_cents=excluded.amount_cents",
      [req.body.partner_id, req.body.month, amount],
    );
    await audit(c, "partner", req.body.partner_id, "ad_spend_recorded", {
      month: req.body.month,
      amount_cents: amount,
    });
  });
  res.json({ ok: true });
});
admin.get("/ledger", async (req, res) => {
  const [a, b] = period(req.query.from, req.query.to);
  res.json({
    lines: (
      await query(
        "SELECT * FROM ledger WHERE partner_id=$1 AND earned_at>=$2 AND earned_at<$3 AND invoice_id IS NULL ORDER BY earned_at",
        [req.query.partner_id, a, b],
      )
    ).rows,
  });
});
export async function createInvoice(body) {
  const [a, b] = period(body.from, body.to);
  return transaction(async (c) => {
    await lock(c, "invoice:" + body.partner_id);
    const lines = (
      await c.query(
        "SELECT * FROM ledger WHERE partner_id=$1 AND earned_at>=$2 AND earned_at<$3 AND invoice_id IS NULL FOR UPDATE",
        [body.partner_id, a, b],
      )
    ).rows;
    if (!lines.length) fail("No unbilled lines in this period.", 409);
    const id = randomUUID();
    await c.query(
      "INSERT INTO invoices(id,partner_id,period_start,period_end) VALUES($1,$2,$3,$4)",
      [id, body.partner_id, body.from, body.to],
    );
    await c.query(
      "UPDATE ledger SET invoice_id=$2,invoiced_at=now() WHERE id=ANY($1::uuid[])",
      [lines.map((l) => l.id), id],
    );
    await audit(c, "invoice", id, "created", {
      partner_id: body.partner_id,
      line_ids: lines.map((l) => l.id),
    });
    return { ok: true, id };
  });
}
admin.post("/invoices", async (req, res) =>
  res.json(await createInvoice(req.body)),
);
admin.post("/invoices/:id/paid", async (req, res) => {
  await transaction(async (c) => {
    const row = (
      await c.query(
        "UPDATE invoices SET paid_at=COALESCE(paid_at,now()) WHERE id=$1 RETURNING id",
        [req.params.id],
      )
    ).rows[0];
    if (!row) fail("Invoice not found.", 404);
    await c.query(
      "UPDATE ledger SET paid_at=COALESCE(paid_at,now()) WHERE invoice_id=$1",
      [row.id],
    );
    await audit(c, "invoice", row.id, "marked_paid", {
      reason: text(req.body.reason),
    });
  });
  res.json({ ok: true });
});
admin.get("/invoices/:id/:format", async (req, res) => {
  const invoice = (
    await query("SELECT * FROM invoices WHERE id=$1", [req.params.id])
  ).rows[0];
  if (!invoice) fail("Invoice not found.", 404);
  const lines = (
      await query(
        "SELECT * FROM ledger WHERE invoice_id=$1 ORDER BY earned_at",
        [invoice.id],
      )
    ).rows,
    p = (
      await query("SELECT business_name FROM partners WHERE id=$1", [
        invoice.partner_id,
      ])
    ).rows[0];
  if (req.params.format === "csv")
    return res.type("text/csv").attachment("invoice.csv").send(csv(lines));
  if (req.params.format === "pdf") return invoicePdf(res, invoice, p, lines);
  fail("Not found.", 404);
});
admin.post("/appointments/:id/override", async (req, res) =>
  res.json(await recordOutcome(req.params.id, req.body, { role: "admin" })),
);
admin.post("/leads/:id/override", async (req, res) => {
  const status = req.body.status,
    reason = text(req.body.reason, 1000);
  if (
    !reason ||
    !["new", "contacted", "booked", "unassigned", "dead", "duplicate"].includes(
      status,
    )
  )
    fail("Choose a status and provide a reason.");
  await transaction(async (c) => {
    await lock(c, "lead:" + req.params.id);
    const l = (
      await c.query("SELECT * FROM leads WHERE id=$1", [req.params.id])
    ).rows[0];
    if (!l) fail("Lead not found.", 404);
    if (["new", "contacted", "booked"].includes(status) && !l.partner_id)
      fail("Assign a partner first.");
    await c.query("UPDATE leads SET status=$2 WHERE id=$1", [l.id, status]);
    await audit(c, "lead", l.id, "admin_override", {
      before: l.status,
      status,
      reason,
    });
  });
  res.json({ ok: true });
});
