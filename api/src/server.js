import express from "express";
import { fileURLToPath } from "node:url";
import { pool } from "./db.js";
import { leads } from "./routes/leads.js";
import { booking } from "./routes/booking.js";
import { sms } from "./routes/sms.js";
import { partner } from "./routes/partner.js";
import { admin } from "./routes/admin.js";
import { tick, deliver } from "./services/scheduler.js";
import { timingSafeEqual } from "node:crypto";
export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", 1);
  app.use((req, res, next) => {
    res.set({
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
      "Cache-Control": "no-store",
      "X-Frame-Options": "DENY",
      "Content-Security-Policy":
        "default-src 'self'; script-src 'self'; style-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
    });
    const origin = req.headers.origin,
      allowed = [process.env.PUBLIC_SITE_URL, process.env.API_BASE_URL];
    if (origin && !allowed.includes(origin))
      return res.status(403).json({ error: "Origin not allowed" });
    if (origin) {
      res.set({
        "Access-Control-Allow-Origin": origin,
        Vary: "Origin",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS",
      });
    }
    if (req.method === "OPTIONS") return res.sendStatus(204);
    next();
  });
  app.use(express.json({ limit: "32kb" }));
  app.use(express.urlencoded({ extended: false, limit: "16kb" }));
  app.get("/healthz", async (req, res) => {
    try {
      await pool.query("SELECT 1");
      res.json({ ok: true });
    } catch {
      res.status(503).json({ ok: false });
    }
  });
  const limits = new Map();
  app.use("/api", (req, res, next) => {
    const key = req.ip + "|" + req.path;
    const now = Date.now(),
      v = limits.get(key);
    if (!v || now - v.at > 60000) limits.set(key, { at: now, n: 1 });
    else if (++v.n > 30)
      return res
        .status(429)
        .json({ error: "Please wait before trying again." });
    if (limits.size > 10000)
      for (const [k, v] of limits) if (now - v.at > 60000) limits.delete(k);
    next();
  });
  app.use("/api/leads", leads);
  app.use("/api/booking", booking);
  app.use("/api/sms", sms);
  app.use("/api/partner", partner);
  app.use("/api/admin", admin);
  app.use(
    "/assets",
    express.static(fileURLToPath(new URL("../public/", import.meta.url))),
  );
  app.get("/partner", (req, res) =>
    res.sendFile("partner.html", {
      root: fileURLToPath(new URL("../public/", import.meta.url)),
    }),
  );
  app.get("/admin", (req, res) =>
    res.sendFile("admin.html", {
      root: fileURLToPath(new URL("../public/", import.meta.url)),
    }),
  );
  app.post("/api/internal/tick", async (req, res) => {
    const expected = "Bearer " + process.env.TICK_SECRET,
      a = Buffer.from(req.get("authorization") || ""),
      b = Buffer.from(expected);
    if (
      !process.env.TICK_SECRET ||
      a.length !== b.length ||
      !timingSafeEqual(a, b)
    )
      return res.sendStatus(401);
    res.json({ ok: true, delivered: await tick() });
  });
  app.use((err, req, res, next) => {
    if (!err.status) console.error("Request failed:", err.code || err.name);
    res
      .status(err.status || 500)
      .json({
        error: err.status ? err.message : "Something went wrong, try again",
      });
  });
  return app;
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const app = createApp();
  let draining = false;
  const timer = setInterval(async () => {
    if (draining) return;
    draining = true;
    try {
      await deliver();
    } catch (e) {
      console.error("Delivery worker failed:", e.code || e.name);
    } finally {
      draining = false;
    }
  }, 1000);
  timer.unref();
  const server = app.listen(process.env.PORT || 3001, "0.0.0.0", () =>
    console.log("Turf API ready"),
  );
  process.on("SIGTERM", () => {
    clearInterval(timer);
    server.close(async () => {
      await pool.end();
      process.exit(0);
    });
  });
}
