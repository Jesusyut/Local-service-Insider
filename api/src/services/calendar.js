import { DateTime } from "luxon";
export function generateSlots(
  partner,
  windows,
  blackouts,
  appointments,
  now = new Date(),
) {
  const zone = partner.timezone,
    start = DateTime.fromJSDate(new Date(now), { zone }).startOf("day"),
    minimum = +new Date(now) + 3 * 3600000,
    duration = partner.appointment_minutes * 60000,
    slots = [];
  for (let day = 0; day < 14; day++) {
    const date = start.plus({ days: day });
    for (const w of windows.filter((w) => w.weekday === date.weekday % 7)) {
      const [h, m] = w.start_time.split(":").map(Number),
        [eh, em] = w.end_time.split(":").map(Number);
      const a = date.set({ hour: h, minute: m }),
        end = date.set({ hour: eh, minute: em });
      for (
        let t = a;
        t.toMillis() + duration <= end.toMillis();
        t = t.plus({ minutes: 30 })
      ) {
        const at = t.toMillis(),
          until = at + duration;
        if (at < minimum) continue;
        if (
          [
            ...blackouts,
            ...appointments.filter((a) =>
              ["booked", "rescheduled"].includes(a.status),
            ),
          ].some(
            (b) => at < +new Date(b.ends_at) && until > +new Date(b.starts_at),
          )
        )
          continue;
        slots.push(t.toUTC().toISO());
      }
    }
  }
  return [...new Set(slots)].sort();
}
export function calendarFile(a, p) {
  const stamp = (d) =>
    new Date(d)
      .toISOString()
      .replace(/[-:]/g, "")
      .replace(/\.\d{3}Z/, "Z");
  const escape = (s) =>
    String(s)
      .replaceAll("\\", "\\\\")
      .replace(/\r?\n/g, "\\n")
      .replaceAll(",", "\\,")
      .replaceAll(";", "\\;");
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Local Insider//Estimate//EN",
    "BEGIN:VEVENT",
    `UID:${a.id}@local-insider`,
    `DTSTAMP:${stamp(a.created_at)}`,
    `DTSTART:${stamp(a.starts_at)}`,
    `DTEND:${stamp(a.ends_at)}`,
    `SEQUENCE:${a.revision}`,
    `STATUS:${a.status === "canceled" ? "CANCELLED" : "CONFIRMED"}`,
    `SUMMARY:${escape("Turf estimate with " + p.business_name)}`,
    `LOCATION:${escape(a.install_address)}`,
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ].join("\r\n");
}
