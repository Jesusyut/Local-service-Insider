import { randomUUID } from "node:crypto";
export function commissionCents(value, pct) {
  if (!Number.isSafeInteger(value) || value < 0)
    throw Error("Invalid job value");
  const raw = String(pct);
  if (!/^\d+(\.\d{1,4})?$/.test(raw) || Number(raw) > 100)
    throw Error("Invalid commission percentage");
  const [whole, decimal = ""] = raw.split("."),
    units = BigInt(whole) * 10000n + BigInt(decimal.padEnd(4, "0"));
  return Number((BigInt(value) * units + 500000n) / 1000000n);
}
export function entitlement(a, outcome) {
  return {
    per_show_fee: a.status === "showed" ? a.per_show_fee_cents : 0,
    commission:
      outcome?.result === "sold" && outcome.deposit_paid_at
        ? commissionCents(outcome.job_value_cents, a.commission_pct)
        : 0,
  };
}
export async function reconcile(c, a, outcome) {
  const target = entitlement(a, outcome);
  for (const kind of ["per_show_fee", "commission"]) {
    const net = Number(
        (
          await c.query(
            "SELECT COALESCE(sum(amount_cents),0) AS total FROM ledger WHERE appointment_id=$1 AND kind=$2",
            [a.id, kind],
          )
        ).rows[0].total,
      ),
      delta = target[kind] - net;
    if (delta)
      await c.query(
        "INSERT INTO ledger(id,partner_id,appointment_id,kind,amount_cents,memo) VALUES($1,$2,$3,$4,$5,$6)",
        [
          randomUUID(),
          a.partner_id,
          a.id,
          kind,
          delta,
          net === 0 && delta > 0 ? "Earned " + kind : "Adjustment to " + kind,
        ],
      );
  }
}
