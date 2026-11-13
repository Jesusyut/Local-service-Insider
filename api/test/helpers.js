import { PGlite } from "@electric-sql/pglite";
import { readFile, readdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { getExampleNumber } from "libphonenumber-js";
import examples from "libphonenumber-js/mobile/examples";
process.env.NODE_ENV = "test";
process.env.PUBLIC_SITE_URL = "https://example.invalid";
process.env.API_BASE_URL = "https://api.example.invalid";
process.env.ALERT_EMAIL = "owner@example.invalid";
process.env.SMS_ENABLED = "false";
process.env.EMAIL_ENABLED = "false";
process.env.META_ENABLED = "false";
export async function database() {
  const db = new PGlite();
  for (const name of (
    await readdir(new URL("../migrations/", import.meta.url))
  ).sort())
    await db.exec(
      await readFile(new URL("../migrations/" + name, import.meta.url), "utf8"),
    );
  let tail = Promise.resolve();
  const adapter = {
    query: (...args) => db.query(...args),
    connect: async () => {
      let release;
      const next = new Promise((r) => (release = r)),
        previous = tail;
      tail = next;
      await previous;
      return { query: (...args) => db.query(...args), release };
    },
  };
  const { useTestPool } = await import("../src/db.js");
  useTestPool(adapter);
  return db;
}
export async function partner(db, overrides = {}) {
  const p = {
    id: randomUUID(),
    business_name: "Demo Installer",
    owner_name: "Owner",
    owner_email: "partner@example.invalid",
    timezone: "UTC",
    commission_pct: 10,
    per_show_fee_cents: 7500,
    status: "active",
    notifications_consent_at: new Date(),
    ...overrides,
  };
  const keys = Object.keys(p);
  await db.query(
    `INSERT INTO partners(${keys}) VALUES(${keys.map((_, i) => "$" + (i + 1))})`,
    Object.values(p),
  );
  await db.query("INSERT INTO territories VALUES($1,$2,$3)", [
    randomUUID(),
    p.id,
    "00001",
  ]);
  for (let day = 0; day < 7; day++)
    await db.query(
      "INSERT INTO availability VALUES($1,$2,$3,'08:00','20:00')",
      [randomUUID(), p.id, day],
    );
  return p;
}
export async function leadBody(overrides = {}) {
  const { CONSENT } = await import("../src/validation.js");
  return {
    first_name: "Test",
    last_name: "Driver",
    mobile: getExampleNumber("US", examples).number,
    email: "test@example.invalid",
    zip: "00001",
    yard_size: "medium",
    current_surface: "grass",
    project_scope: "turf",
    timeline: "asap",
    consent: true,
    consent_version: "v1",
    consent_text: CONSENT,
    contact_timezone: "UTC",
    meta_event_id: randomUUID(),
    ...overrides,
  };
}
