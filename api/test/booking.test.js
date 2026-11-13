import test from "node:test";
import assert from "node:assert/strict";
import { DateTime } from "luxon";
import { database, partner, leadBody } from "./helpers.js";
import { intake } from "../src/routes/leads.js";
import { book, bookingView, cancel, ics } from "../src/services/booking.js";
import { generateSlots } from "../src/services/calendar.js";
test("two leads booking one slot yield one success and one conflict; retries are idempotent", async () => {
  const db = await database();
  try {
    await partner(db);
    const b = await leadBody(),
      a = await intake(b),
      z = await intake({
        ...b,
        mobile: b.mobile.slice(0, -1) + (b.mobile.endsWith("1") ? "2" : "1"),
      });
    const view = await bookingView(a.booking_token);
    const time = view.slots[2];
    assert.ok(time);
    const results = await Promise.allSettled([
      book(a.booking_token, {
        starts_at: time,
        install_address: "Test install address",
      }),
      book(z.booking_token, {
        starts_at: time,
        install_address: "Other install address",
      }),
    ]);
    assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
    assert.equal(
      results.find((r) => r.status === "rejected").reason.status,
      409,
    );
    const token =
      results[0].status === "fulfilled" ? a.booking_token : z.booking_token;
    const one = await book(token, {
      starts_at: time,
      install_address: "Test install address",
    });
    assert.equal((await db.query("SELECT * FROM appointments")).rows.length, 1);
    assert.match(await ics(token), /BEGIN:VCALENDAR/);
    assert.equal(
      one.appointment.partner_id,
      (await db.query("SELECT id FROM partners")).rows[0].id,
    );
    await cancel(token);
    assert.equal((await bookingView(token)).appointment.status, "canceled");
  } finally {
    await db.close();
  }
});
test("slots honor minimum notice, weekly windows, blackouts, duration and occupied ranges", () => {
  const p = { timezone: "UTC", appointment_minutes: 60 };
  const now = DateTime.utc(2030, 1, 7, 6).toJSDate();
  const slots = generateSlots(
    p,
    [{ weekday: 1, start_time: "08:00", end_time: "12:00" }],
    [{ starts_at: "2030-01-07T10:00Z", ends_at: "2030-01-07T11:00Z" }],
    [
      {
        status: "booked",
        starts_at: "2030-01-07T11:00Z",
        ends_at: "2030-01-07T12:00Z",
      },
    ],
    now,
  );
  assert.ok(slots.includes("2030-01-07T09:00:00.000Z"));
  assert.ok(!slots.includes("2030-01-07T08:30:00.000Z"));
  assert.ok(!slots.includes("2030-01-07T09:30:00.000Z"));
  assert.ok(!slots.includes("2030-01-07T11:00:00.000Z"));
});
