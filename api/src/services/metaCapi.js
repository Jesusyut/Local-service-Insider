import { createHash } from "node:crypto";
import { enqueue } from "./queue.js";
export const hash = (v) =>
  createHash("sha256").update(String(v).trim().toLowerCase()).digest("hex");
export async function queueMeta(c, name, id, lead, custom_data = {}) {
  const user_data = {
    ph: [hash(lead.phone_e164.replace(/\D/g, ""))],
    fn: [hash(lead.first_name)],
    ln: [hash(lead.last_name)],
    zp: [hash(lead.zip)],
    client_ip_address: lead.client_ip,
    client_user_agent: lead.user_agent,
  };
  if (lead.email) user_data.em = [hash(lead.email)];
  if (lead.fbp) user_data.fbp = lead.fbp;
  if (lead.fbc) user_data.fbc = lead.fbc;
  await enqueue(c, "meta-" + name + "-" + id, "meta", "meta", name, {
    leadId: lead.id,
    event: {
      event_name: name,
      event_id: id,
      event_time: Math.floor(Date.now() / 1000),
      action_source: "website",
      event_source_url: process.env.PUBLIC_SITE_URL,
      user_data,
      custom_data,
    },
  });
}
export async function sendMeta(payload) {
  if (process.env.META_ENABLED !== "true") return { logged: true };
  if (!process.env.META_PIXEL_ID || !process.env.META_CAPI_TOKEN)
    throw Error("Meta configuration missing");
  const version = process.env.META_GRAPH_VERSION;
  if (!/^v\d+\.\d+$/.test(version || ""))
    throw Error("META_GRAPH_VERSION is required");
  const r = await fetch(
    `https://graph.facebook.com/${version}/${encodeURIComponent(process.env.META_PIXEL_ID)}/events`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + process.env.META_CAPI_TOKEN,
      },
      body: JSON.stringify({ data: [payload.event] }),
      signal: AbortSignal.timeout(15000),
    },
  );
  if (!r.ok) throw Error("Meta request failed: " + r.status);
  return { id: payload.event.event_id };
}
