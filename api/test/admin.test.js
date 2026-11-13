import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { database, partner, leadBody } from "./helpers.js";
import {
  savePartner,
  assignTerritories,
  createInvoice,
} from "../src/routes/admin.js";
import { intake } from "../src/routes/leads.js";
import { book, bookingView } from "../src/services/booking.js";
import { recordOutcome } from "../src/services/outcomes.js";
import { csv } from "../src/services/reports.js";
test("territories reject active conflicts by business name and allow reassignment from paused partners", async () => {
  const db = await database();
  try {
    const a = await partner(db),
      b = await savePartner({
        business_name: "Other Installer",
        owner_name: "Owner",
        owner_email: "other@example.invalid",
        timezone: "UTC",
        commission_pct: 12,
        status: "active",
      });
    await assert.rejects(
      () => assignTerritories(b.id, "00001"),
      (e) => e.status === 409 && e.message.includes(a.business_name),
    );
    await db.query("UPDATE partners SET status='paused' WHERE id=$1", [a.id]);
    await assignTerritories(b.id, "00001, 00002");
    assert.equal(
      (await db.query("SELECT partner_id FROM territories WHERE zip='00001'"))
        .rows[0].partner_id,
      b.id,
    );
  } finally {
    await db.close();
  }
});
test("invoicing claims lines once and leaves earned amounts immutable; CSV prevents spreadsheet formulas", async () => {
  const db = await database();
  try {
    const p = await partner(db),
      l = await intake(await leadBody()),
      v = await bookingView(l.booking_token),
      { appointment: a } = await book(l.booking_token, {
        starts_at: v.slots[0],
        install_address: "Test install address",
      });
    await recordOutcome(
      a.id,
      { status: "showed" },
      { role: "partner", partner_id: p.id },
    );
    const body = { partner_id: p.id, from: "2000-01-01", to: "2099-12-31" },
      invoice = await createInvoice(body);
    assert.ok(invoice.id);
    await assert.rejects(() => createInvoice(body), { status: 409 });
    const line = (await db.query("SELECT * FROM ledger")).rows[0];
    assert.equal(Number(line.amount_cents), 7500);
    assert.ok(line.invoiced_at);
    assert.equal(line.invoice_id, invoice.id);
    await assert.rejects(
      () => db.query("UPDATE ledger SET amount_cents=1 WHERE id=$1", [line.id]),
      /adjustment line/,
    );
    await assert.rejects(
      () => db.query("DELETE FROM ledger WHERE id=$1", [line.id]),
      /cannot be deleted/,
    );
    assert.match(csv([{ name: "=SUM(A1)", value: "test" }]), /"'=SUM/);
  } finally {
    await db.close();
  }
});
