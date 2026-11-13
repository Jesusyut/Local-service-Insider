if (!process.env.API_BASE_URL || !process.env.TICK_SECRET)
  throw Error("Tick configuration missing");
const r = await fetch(
  process.env.API_BASE_URL.replace(/\/$/, "") + "/api/internal/tick",
  {
    method: "POST",
    headers: { Authorization: "Bearer " + process.env.TICK_SECRET },
    signal: AbortSignal.timeout(240000),
  },
);
if (!r.ok) throw Error("Tick failed: " + r.status);
console.log("Tick completed");
