import { parsePhoneNumberFromString } from "libphonenumber-js";
import { DateTime, IANAZone } from "luxon";
export const CONSENT =
  "By checking this box I agree to receive calls and texts about my project, including automated texts, from Local Insider and its installation partner at the number provided. Consent is not a condition of purchase. Msg & data rates may apply. Reply STOP to opt out.";
export const choices = {
  yard_size: ["small", "medium", "large", "unsure"],
  current_surface: ["grass", "dirt_rock", "pavers_concrete", "mixed"],
  project_scope: ["turf", "turf_hardscape", "putting_green", "pet_area"],
  timeline: ["asap", "one_three_months", "three_plus_months", "just_pricing"],
};
export const fail = (message, status = 400) => {
  throw Object.assign(Error(message), { status });
};
export const text = (v, max = 200) =>
  String(v ?? "")
    .trim()
    .slice(0, max);
export const area = (v) =>
  text(v, 200)
    .replace(/[^a-zA-Z ]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 40);
export function phone(v) {
  const n = parsePhoneNumberFromString(text(v, 40));
  if (!n?.isValid()) fail("Enter a mobile number including its country code.");
  return n.number;
}
export function timezone(v) {
  const z = text(v, 100);
  if (z !== "UTC" && !IANAZone.isValidZone(z)) fail("Choose a valid timezone.");
  return z;
}
export const uuid = (v) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    v,
  );
export function validateLead(b) {
  const v = {};
  for (const [k, values] of Object.entries(choices)) {
    if (!values.includes(b[k])) fail("Complete every project question.");
    v[k] = b[k];
  }
  if (
    b.consent !== true ||
    b.consent_version !== "v1" ||
    b.consent_text !== CONSENT
  )
    fail("Please agree to the current calls and texts disclosure.");
  for (const k of ["first_name", "last_name"]) {
    v[k] = text(b[k], 80);
    if (!v[k]) fail("Enter your first and last name.");
  }
  v.phone_e164 = phone(b.mobile);
  v.email = text(b.email, 254).toLowerCase();
  if (v.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email))
    fail("Enter a valid email.");
  v.zip = text(b.zip, 5);
  if (!/^\d{5}$/.test(b.zip)) fail("Enter exactly five ZIP digits.");
  if (!uuid(b.meta_event_id)) fail("Refresh and try again.");
  v.contact_timezone = timezone(b.contact_timezone);
  v.notes = text(b.notes, 2000);
  v.area_param = area(b.area);
  for (const k of [
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_content",
    "utm_term",
    "fbclid",
    "fbp",
    "fbc",
  ])
    v[k] = text(b[k], 500);
  return { ...v, meta_event_id: b.meta_event_id };
}
export function cents(value) {
  const n = Number(value);
  if (!Number.isSafeInteger(n) || n < 0 || n > 2147483647)
    fail("Enter a valid amount in cents.");
  return n;
}
export function futureDate(v) {
  const d = DateTime.fromISO(String(v), { setZone: true });
  if (!d.isValid) fail("Enter a valid timestamp.");
  return d.toUTC().toISO();
}
