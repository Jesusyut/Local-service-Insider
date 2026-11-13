"use strict";
(async () => {
  const root = document.querySelector("#booking"),
    error = document.querySelector("#error"),
    token = new URLSearchParams(location.search).get("t"),
    base = window.TURF_CONFIG?.API_BASE_URL;
  let selected = "",
    selectedDay = "",
    address = "",
    busy = false;
  const esc = (v) =>
    String(v ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
  async function api(path, body) {
    if (!base)
      throw Error("Booking is not configured yet. Please try again shortly.");
    const r = await fetch(
      base.replace(/\/$/, "") +
        "/api/booking/" +
        encodeURIComponent(token || "") +
        path,
      {
        method: body ? "POST" : "GET",
        headers: body ? { "Content-Type": "application/json" } : {},
        body: body ? JSON.stringify(body) : undefined,
      },
    );
    const d = await r.json();
    if (!r.ok) throw Error(d.error);
    return d;
  }
  async function load() {
    const d = await api("");
    if (d.pending) {
      root.textContent = d.message;
      return;
    }
    const dayKey = (t) =>
      new Intl.DateTimeFormat("en-CA", {
        timeZone: d.timezone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date(t));
    const days = [...new Set(d.slots.map(dayKey))];
    if (!days.includes(selectedDay)) selectedDay = days[0] || "";
    const fmt = (t) =>
      new Intl.DateTimeFormat(undefined, {
        timeZone: d.timezone,
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }).format(new Date(t));
    root.innerHTML = `<p class="intro">A free ${d.appointment_minutes}-minute estimate with <strong>${esc(d.partner_name)}</strong>.</p><p class="fine">All times shown in ${esc(d.timezone)}.</p>${d.appointment && d.appointment.status !== "canceled" ? `<section class="card"><h2>Your appointment</h2><p>${esc(fmt(d.appointment.starts_at))}</p><p>${esc(d.appointment.install_address)}</p><p>Status: ${esc(d.appointment.status)}</p><div class="actions"><a class="button" href="${esc(base)}/api/booking/${encodeURIComponent(token)}/calendar.ics">Add to calendar</a>${["booked", "rescheduled"].includes(d.appointment.status) ? '<button type="button" id="cancel">Cancel appointment</button>' : ""}</div></section>` : ""}<section class="card"><h2>${d.appointment ? "Choose a new time" : "Find your time"}</h2>${
      d.slots.length
        ? `<form id="book"><label>Appointment day<select id="day">${days.map((day) => `<option value="${day}" ${day === selectedDay ? "selected" : ""}>${day}</option>`).join("")}</select></label><div class="slots">${d.slots
            .filter((t) => dayKey(t) === selectedDay)
            .map(
              (t) =>
                `<button class="slot" type="button" data-time="${esc(t)}">${esc(fmt(t))}</button>`,
            )
            .join(
              "",
            )}</div><label>Install address<textarea name="install_address" autocomplete="street-address" required minlength="5" maxlength="500">${esc(address || d.appointment?.install_address)}</textarea></label><button id="save">${d.appointment ? "Reschedule estimate" : "Book my free estimate"} →</button><p class="fine">No payment required. You can cancel or reschedule from this page.</p></form>`
        : "<p>No open times are available right now. Please check back shortly.</p>"
    }</section>`;
    root.querySelector("#day")?.addEventListener("change", async (e) => {
      address = root.querySelector("textarea").value;
      selectedDay = e.target.value;
      selected = "";
      await load();
    });
    root.querySelectorAll("[data-time]").forEach(
      (b) =>
        (b.onclick = () => {
          selected = b.dataset.time;
          root
            .querySelectorAll("[data-time]")
            .forEach((x) => x.classList.toggle("selected", x === b));
        }),
    );
    root.querySelector("#book")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (busy) return;
      if (!selected) {
        error.textContent = "Choose an appointment time.";
        return;
      }
      address = root.querySelector("textarea").value;
      busy = true;
      root.querySelector("#save").disabled = true;
      try {
        await api("", { starts_at: selected, install_address: address });
        location.assign("thanks.html?t=" + encodeURIComponent(token));
      } catch (err) {
        error.textContent = err.message;
        await load();
      } finally {
        busy = false;
      }
    });
    root.querySelector("#cancel")?.addEventListener("click", async () => {
      if (!confirm("Cancel this estimate appointment?")) return;
      try {
        await api("/cancel", {});
        await load();
      } catch (err) {
        error.textContent = err.message;
      }
    });
  }
  try {
    await load();
  } catch (err) {
    root.textContent = "";
    error.textContent = err.message;
  }
})();
