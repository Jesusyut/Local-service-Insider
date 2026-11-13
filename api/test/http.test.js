import test from "node:test";
import assert from "node:assert/strict";
import twilio from "twilio";
import bcrypt from "bcryptjs";
import { database, partner, leadBody } from "./helpers.js";
import { createApp } from "../src/server.js";
import { magic } from "../src/services/auth.js";
test("HTTP health, auth isolation, origin checks and Twilio signatures are enforced", async () => {
  const db = await database();
  let server;
  try {
    const p = await partner(db);
    process.env.MAGIC_LINK_SECRET = "test-secret-".repeat(4);
    process.env.ADMIN_PASSWORD_HASH = await bcrypt.hash("test-password", 10);
    process.env.TWILIO_AUTH_TOKEN = "signature-test-secret";
    server = createApp().listen(0, "127.0.0.1");
    await new Promise((r) => server.once("listening", r));
    const base = "http://127.0.0.1:" + server.address().port;
    const request = async (path, b, token, origin) => {
      const r = await fetch(base + path, {
        method: b ? "POST" : "GET",
        headers: {
          ...(b ? { "Content-Type": "application/json" } : {}),
          ...(token ? { Authorization: "Bearer " + token } : {}),
          ...(origin ? { Origin: origin } : {}),
        },
        body: b ? JSON.stringify(b) : undefined,
      });
      return { status: r.status, data: await r.json() };
    };
    assert.equal((await request("/healthz")).status, 200);
    for (const path of [
      "/partner",
      "/admin",
      "/assets/partner.js",
      "/assets/portal.css",
    ])
      assert.equal((await fetch(base + path)).status, 200, path);
    assert.equal((await request("/api/admin/data")).status, 401);
    const admin = (
      await request("/api/admin/login", { password: "test-password" })
    ).data.token;
    assert.ok(admin);
    assert.equal((await request("/api/admin/data", null, admin)).status, 200);
    const pt = (await request("/api/partner/session", { token: magic(p.id) }))
      .data.token;
    assert.equal((await request("/api/partner/data", null, pt)).status, 200);
    assert.equal((await request("/api/admin/data", null, pt)).status, 401);
    assert.equal(
      (
        await request(
          "/api/leads",
          await leadBody(),
          null,
          "https://untrusted.invalid",
        )
      ).status,
      403,
    );
    let r = await fetch(base + "/api/sms/inbound", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        From: (await leadBody()).mobile,
        Body: "STOP",
        MessageSid: "http-stop",
      }),
    });
    assert.equal(r.status, 403);
    const b = {
        From: (await leadBody()).mobile,
        Body: "STOP",
        MessageSid: "http-stop",
      },
      signature = twilio.getExpectedTwilioSignature(
        process.env.TWILIO_AUTH_TOKEN,
        process.env.API_BASE_URL + "/api/sms/inbound",
        b,
      );
    r = await fetch(base + "/api/sms/inbound", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "X-Twilio-Signature": signature,
      },
      body: new URLSearchParams(b),
    });
    assert.equal(r.status, 200);
    assert.equal(
      (await db.query("SELECT * FROM sms_suppressions")).rows.length,
      1,
    );
    assert.equal(
      (
        await request(
          "/api/admin/dashboard?from=2000-01-01&to=2099-01-01",
          null,
          admin,
        )
      ).status,
      200,
    );
  } finally {
    if (server) await new Promise((r) => server.close(r));
    await db.close();
  }
});
