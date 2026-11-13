import { Router } from "express";
import { bookingView, book, cancel, ics } from "../services/booking.js";
export const booking = Router();
booking.get("/:token/calendar.ics", async (req, res) =>
  res
    .type("text/calendar")
    .set("Content-Disposition", 'attachment; filename="estimate.ics"')
    .send(await ics(req.params.token)),
);
booking.get("/:token", async (req, res) =>
  res.json(await bookingView(req.params.token)),
);
booking.post("/:token", async (req, res) =>
  res.json(await book(req.params.token, req.body)),
);
booking.post("/:token/cancel", async (req, res) =>
  res.json(await cancel(req.params.token)),
);
