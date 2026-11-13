"use strict";
(() => {
  const app = document.querySelector("#app"),
    error = document.querySelector("#error"),
    status = document.querySelector("#status");
  let token = sessionStorage.getItem("turf-admin") || "",
    data;
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
  const money = (c) =>
    new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: "USD",
    }).format(Number(c || 0) / 100);
  async function api(path, body, method) {
    const r = await fetch("/api/admin" + path, {
      method: method || (body ? "POST" : "GET"),
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: "Bearer " + token } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!r.ok) {
      let e;
      try {
        e = await r.json();
      } catch {}
      throw Error(e?.error || "Request failed");
    }
    return r.json();
  }
  async function download(path, name) {
    const r = await fetch("/api/admin" + path, {
      headers: { Authorization: "Bearer " + token },
    });
    if (!r.ok) throw Error("Export failed");
    const url = URL.createObjectURL(await r.blob()),
      a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  }
  const input = (name, label, type = "text", value = "", required = false) =>
    `<label>${label}<input name="${name}" type="${type}" value="${esc(value)}" ${required ? "required" : ""}></label>`;
  const select = (name, label, options) =>
    `<label>${label}<select name="${name}">${options}</select></label>`;
  function partnerOptions(all = false) {
    return (
      (all ? '<option value="">All partners</option>' : "") +
      data.partners
        .map(
          (p) =>
            `<option value="${p.id}">${esc(p.business_name)} (${esc(p.status)})</option>`,
        )
        .join("")
    );
  }
  const formData = (f) => Object.fromEntries(new FormData(f));
  function bindForm(id, fn) {
    document.querySelector("#" + id).onsubmit = async (e) => {
      e.preventDefault();
      error.textContent = "";
      status.textContent = "";
      const button = e.target.querySelector(
        "button[type=submit],button:not([type])",
      );
      if (button) button.disabled = true;
      try {
        await fn(formData(e.target), e.target);
        status.textContent = "Saved.";
      } catch (err) {
        error.textContent = err.message;
      } finally {
        if (button) button.disabled = false;
      }
    };
  }
  function login() {
    app.innerHTML = `<p class="eyebrow">Owner access</p><h1>The pipeline desk.</h1><form id="login">${input("password", "Password", "password", "", true)}<button>Sign in</button></form>`;
    bindForm("login", async (b) => {
      token = (await api("/login", b)).token;
      sessionStorage.setItem("turf-admin", token);
      await load();
    });
  }
  async function dashboard(b) {
    const d = await api("/dashboard?" + new URLSearchParams(b));
    document.querySelector("#metrics").innerHTML =
      `<div class="metrics">${Object.entries(d.counts)
        .map(([k, v]) => `<div>${esc(k)}<strong>${v}</strong></div>`)
        .join("")}${Object.entries(d.revenue)
        .map(
          ([k, v]) =>
            `<div>${esc(k.replaceAll("_", " ").replace(" cents", ""))}<strong>${money(v)}</strong></div>`,
        )
        .join(
          "",
        )}<div>Margin<strong>${money(d.margin_cents)}</strong></div></div><p>Booked / lead: ${(100 * d.rates.booked_per_lead).toFixed(1)}% · Showed / booked: ${(100 * d.rates.showed_per_booked).toFixed(1)}% · Sold / showed: ${(100 * d.rates.sold_per_showed).toFixed(1)}%</p><p>Ad spend: ${money(d.ad_spend_cents)} · Cost / lead: ${d.cost_per_lead_cents === null ? "—" : money(d.cost_per_lead_cents)} · Cost / booking: ${d.cost_per_booked_cents === null ? "—" : money(d.cost_per_booked_cents)} · Cost / sold: ${d.cost_per_sold_cents === null ? "—" : money(d.cost_per_sold_cents)}</p><p class="fine">${esc(d.spend_note)} Counts follow the lead-created date range. Earnings include adjustments for those appointments.</p>`;
  }
  function editPartner(p = {}) {
    document.querySelector("#partner-editor").innerHTML =
      `<form id="partner-form"><input type="hidden" name="id" value="${esc(p.id)}"><div class="fields">${input("business_name", "Business name", "text", p.business_name, true)}${input("owner_name", "Owner name", "text", p.owner_name, true)}${input("owner_email", "Owner email", "email", p.owner_email, true)}${input("owner_phone", "Owner phone, including country code", "tel", p.owner_phone)}${input("timezone", "IANA timezone", "text", p.timezone, true)}${input("commission_pct", "Commission percent", "number", p.commission_pct ?? 10, true)}${input("show_fee", "Fee per showed appointment (USD)", "number", Number(p.per_show_fee_cents || 0) / 100)}${input("min_job", "Minimum job value (USD)", "number", Number(p.min_job_value_cents || 0) / 100)}${input("appointment_minutes", "Appointment length in minutes", "number", p.appointment_minutes || 60)}${select("status", "Partner status", ["active", "paused", "churned"].map((s) => `<option ${p.status === s ? "selected" : ""}>${s}</option>`).join(""))}</div><label>Additional notification phones, one per line<textarea name="phones">${esc((p.notify_phones || []).join("\n"))}</textarea></label><label>Additional notification emails, one per line<textarea name="emails">${esc((p.notify_emails || []).join("\n"))}</textarea></label><label class="consent"><input name="notifications_consent" type="checkbox" ${p.notifications_consent_at ? "checked" : ""}><span>The partner agreed to operational text notifications at these numbers.</span></label>${input("reason", "Change note")}<button>Save partner</button></form>`;
    const f = document.querySelector("#partner-form");
    f.querySelectorAll("[type=number]").forEach((n) => {
      n.min = "0";
      n.step =
        n.name === "commission_pct"
          ? "0.0001"
          : n.name === "appointment_minutes"
            ? "1"
            : "0.01";
    });
    bindForm("partner-form", async (b) => {
      await api(
        "/partners" + (b.id ? "/" + b.id : ""),
        {
          ...b,
          notify_phones: b.phones
            .split(/[\n,]+/)
            .map((s) => s.trim())
            .filter(Boolean),
          notify_emails: b.emails
            .split(/[\n,]+/)
            .map((s) => s.trim())
            .filter(Boolean),
          per_show_fee_cents: Math.round(Number(b.show_fee) * 100),
          min_job_value_cents: Math.round(Number(b.min_job) * 100),
          notifications_consent: b.notifications_consent === "on",
        },
        b.id ? "PUT" : "POST",
      );
      await load();
    });
  }
  async function load() {
    data = await api("/data");
    const today = new Date().toISOString().slice(0, 10),
      month = today.slice(0, 7) + "-01";
    app.innerHTML = `<p class="eyebrow">Pipeline operations</p><h1>Every project. Every dollar.</h1><nav><a href="#dashboard">Dashboard</a><a href="#partners">Partners</a><a href="#inventory">Unassigned leads</a><a href="#invoices">Invoices</a><a href="#overrides">Overrides</a><button id="logout">Sign out</button></nav><section class="card" id="dashboard"><h2>Funnel dashboard</h2><form id="filter"><div class="fields">${input("from", "From", "date", month, true)}${input("to", "Through", "date", today, true)}${select("partner_id", "Partner", partnerOptions(true))}${input("utm_campaign", "Campaign (optional)")}</div><button>Update dashboard</button></form><div id="metrics"></div><h3>Monthly ad spend</h3><form id="spend">${select("partner_id", "Partner", partnerOptions())}${input("month", "Month", "month", today.slice(0, 7), true)}${input("value", "Ad spend (USD)", "number", "", true)}<button>Save ad spend</button></form></section><section class="card" id="partners"><h2>Partners & territories</h2><button id="new-partner">New partner</button><div class="scroll"><table><thead><tr><th>Partner</th><th>Status</th><th>Commission</th><th>ZIPs</th><th></th></tr></thead><tbody>${data.partners
      .map(
        (p) =>
          `<tr><td>${esc(p.business_name)}</td><td>${esc(p.status)}</td><td>${esc(p.commission_pct)}% + ${money(p.per_show_fee_cents)} / show</td><td>${esc(
            data.territories
              .filter((t) => t.partner_id === p.id)
              .map((t) => t.zip)
              .join(", "),
          )}</td><td><button data-edit="${p.id}">Edit</button></td></tr>`,
      )
      .join(
        "",
      )}</tbody></table></div><div id="partner-editor"></div><h3>Assign ZIP territories</h3><form id="territories">${select("partner_id", "Partner", partnerOptions())}<label>ZIP codes<textarea name="zips" required></textarea></label><button>Assign territories</button></form></section><section class="card" id="inventory"><h2>Unassigned projects</h2><button id="export">Export CSV</button>${data.unassigned.map((l) => `<article class="card"><h3>${esc(l.first_name)} ${esc(l.last_name)}</h3><p>${esc(l.phone_e164)} · ZIP ${esc(l.zip)} · ${esc(l.project_scope)} · ${esc(l.timeline)}</p><p>Lead reference: ${l.id}</p><form class="assign"><input type="hidden" name="lead_id" value="${l.id}">${select("partner_id", "Assign to", partnerOptions())}<button>Assign and notify</button></form></article>`).join("") || "<p>No unassigned projects.</p>"}</section><section class="card" id="invoices"><h2>Invoices</h2><form id="invoice-filter">${select("partner_id", "Partner", partnerOptions())}${input("from", "From", "date", month, true)}${input("to", "Through", "date", today, true)}<button>Preview unbilled lines</button></form><div id="unbilled"></div><div class="scroll"><table><thead><tr><th>Invoice</th><th>Partner</th><th>Status</th><th>Exports / payment</th></tr></thead><tbody>${data.invoices.map((i) => `<tr><td>${i.id}</td><td>${esc(data.partners.find((p) => p.id === i.partner_id)?.business_name)}</td><td>${i.paid_at ? "Paid" : "Unpaid"}</td><td><button data-download="${i.id}/csv">CSV</button><button data-download="${i.id}/pdf">PDF</button>${i.paid_at ? "" : `<button data-paid="${i.id}">Mark paid</button>`}</td></tr>`).join("")}</tbody></table></div></section><section class="card" id="overrides"><h2>Manual corrections</h2><p>Every correction is recorded with your reason. Earned amounts are adjusted with new ledger lines.</p><form id="override">${select("entity", "Record", '<option value="appointments">Appointment</option><option value="leads">Lead</option>')}${input("id", "Record reference", "text", "", true)}${input("status", "Status (optional for outcome changes)")}${select("result", "Outcome", '<option value="">No outcome change</option><option value="sold">Sold</option><option value="lost">Lost</option>')}${input("value", "Sold job value (USD)", "number")}${input("deposit_paid_at", "Deposit paid date", "date")}${select("lost_reason", "Lost reason", '<option value="">No change</option>' + ["price", "went_with_someone_else", "not_ready", "bad_lead", "other"].map((r) => `<option>${r}</option>`).join(""))}${input("reason", "Reason for correction", "text", "", true)}<button>Record correction</button></form></section><section class="card"><h2>Delivery failures</h2>${data.failures.map((m) => `<p>${esc(m.channel)} · ${m.id} · ${esc(m.last_error)} · ${m.attempts} attempts</p>`).join("") || "<p>No unresolved delivery failures.</p>"}</section>`;
    document.querySelector("#logout").onclick = () => {
      sessionStorage.removeItem("turf-admin");
      token = "";
      login();
    };
    document.querySelector("#new-partner").onclick = () => editPartner();
    app
      .querySelectorAll("[data-edit]")
      .forEach(
        (b) =>
          (b.onclick = () =>
            editPartner(data.partners.find((p) => p.id === b.dataset.edit))),
      );
    bindForm("filter", dashboard);
    await dashboard(formData(document.querySelector("#filter")));
    bindForm("spend", async (b) =>
      api("/spend", {
        ...b,
        month: b.month + "-01",
        amount_cents: Math.round(Number(b.value) * 100),
      }),
    );
    bindForm("territories", async (b) => {
      await api("/territories", b);
      await load();
    });
    app.querySelectorAll(".assign").forEach(
      (f) =>
        (f.onsubmit = async (e) => {
          e.preventDefault();
          try {
            await api("/assign", formData(f));
            await load();
          } catch (err) {
            error.textContent = err.message;
          }
        }),
    );
    document.querySelector("#export").onclick = () =>
      download("/unassigned.csv", "unassigned.csv").catch(
        (e) => (error.textContent = e.message),
      );
    bindForm("invoice-filter", async (b) => {
      const d = await api("/ledger?" + new URLSearchParams(b));
      document.querySelector("#unbilled").innerHTML =
        `<p>${d.lines.length} unbilled lines · ${money(d.lines.reduce((s, l) => s + Number(l.amount_cents), 0))}</p><div class="scroll"><table>${d.lines.map((l) => `<tr><td>${esc(l.kind)}</td><td>${l.appointment_id}</td><td>${money(l.amount_cents)}</td></tr>`).join("")}</table></div>${d.lines.length ? '<button id="create-invoice">Mark these lines invoiced</button>' : ""}`;
      document
        .querySelector("#create-invoice")
        ?.addEventListener("click", async () => {
          try {
            await api("/invoices", b);
            await load();
          } catch (err) {
            error.textContent = err.message;
          }
        });
    });
    app
      .querySelectorAll("[data-download]")
      .forEach(
        (b) =>
          (b.onclick = () =>
            download(
              "/invoices/" + b.dataset.download,
              "invoice." + b.dataset.download.split("/")[1],
            ).catch((e) => (error.textContent = e.message))),
      );
    app.querySelectorAll("[data-paid]").forEach(
      (b) =>
        (b.onclick = async () => {
          try {
            await api("/invoices/" + b.dataset.paid + "/paid", {});
            await load();
          } catch (err) {
            error.textContent = err.message;
          }
        }),
    );
    bindForm("override", async (b) => {
      const body = { reason: b.reason };
      for (const k of ["status", "result", "deposit_paid_at", "lost_reason"])
        if (b[k]) body[k] = b[k];
      if (b.value) body.job_value_cents = Math.round(Number(b.value) * 100);
      await api("/" + b.entity + "/" + b.id + "/override", body);
      await load();
    });
  }
  if (token)
    load().catch((err) => {
      error.textContent = err.message;
      login();
    });
  else login();
})();
