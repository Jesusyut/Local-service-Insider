import PDFDocument from "pdfkit";
export const csv = (rows) => {
  if (!rows.length) return "";
  const keys = Object.keys(rows[0]),
    safe = (v) =>
      '"' +
      String(v ?? "")
        .replace(/^[=+@\-\t\r]/, "'$&")
        .replaceAll('"', '""') +
      '"';
  return [
    keys.map(safe).join(","),
    ...rows.map((r) =>
      keys
        .map((k) =>
          safe(typeof r[k] === "object" ? JSON.stringify(r[k]) : r[k]),
        )
        .join(","),
    ),
  ].join("\r\n");
};
export function invoicePdf(res, invoice, partner, lines) {
  const doc = new PDFDocument({ margin: 48 });
  res.type("application/pdf");
  doc.pipe(res);
  doc.fontSize(24).text("Local Insider");
  doc.fontSize(16).text("Invoice " + invoice.id);
  doc
    .fontSize(11)
    .text(partner.business_name)
    .text(
      `Period: ${String(invoice.period_start).slice(0, 10)} to ${String(invoice.period_end).slice(0, 10)}`,
    )
    .moveDown();
  for (const l of lines) {
    if (doc.y > 700) doc.addPage();
    doc
      .text(`${l.kind.replaceAll("_", " ")} | appointment ${l.appointment_id}`)
      .text(`${l.memo}: $${(Number(l.amount_cents) / 100).toFixed(2)}`)
      .moveDown(0.4);
  }
  doc
    .moveDown()
    .fontSize(16)
    .text(
      "Total: $" +
        (lines.reduce((s, l) => s + Number(l.amount_cents), 0) / 100).toFixed(
          2,
        ),
    );
  doc.end();
}
