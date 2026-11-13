import { randomUUID } from "node:crypto";
import { audit } from "../db.js";
export async function enqueue(
  c,
  key,
  channel,
  recipient,
  body,
  { leadId = null, dueAt = new Date(), ...payload } = {},
) {
  if (!recipient) return;
  const inserted = await c.query(
    "INSERT INTO messages(id,lead_id,direction,channel,body,status,delivery_key,recipient,due_at,payload) VALUES($1,$2,'outbound',$3,$4,'queued',$5,$6,$7,$8) ON CONFLICT(delivery_key) DO NOTHING RETURNING id",
    [
      randomUUID(),
      leadId,
      channel,
      body,
      key,
      recipient,
      dueAt,
      JSON.stringify(payload),
    ],
  );
  if (inserted.rows[0])
    await audit(c, "message", inserted.rows[0].id, "queued", {
      channel,
      lead_id: leadId,
      due_at: dueAt,
    });
}
export function publicLink(path) {
  const base = process.env.PUBLIC_SITE_URL;
  if (!base) throw Error("PUBLIC_SITE_URL is required");
  return new URL(path, base).href;
}
export function apiLink(path) {
  const base = process.env.API_BASE_URL;
  if (!base) throw Error("API_BASE_URL is required");
  return new URL(path, base).href;
}
export async function adminAlert(c, key, body, leadId = null) {
  await enqueue(c, key + "-email", "email", process.env.ALERT_EMAIL, body, {
    leadId,
    subject: "Local Insider pipeline alert",
  });
  await enqueue(c, key + "-sms", "sms", process.env.ALERT_PHONE, body, {
    leadId,
    timezone: process.env.ALERT_TIMEZONE,
    consent: process.env.ALERT_SMS_CONSENT === "true",
    category: "operator",
  });
}
