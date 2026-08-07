import { Router } from "express";
import { searchStations, getArrivals } from "../services/tflClient";

export const stationsRouter = Router();

// GET /stations/search?q=farring — used by the journey planner's
// from/to autocomplete fields.
stationsRouter.get("/search", async (req, res) => {
  const query = req.query.q;

  if (typeof query !== "string" || query.trim().length < 2) {
    res.status(400).json({ error: "Query param 'q' must be at least 2 characters" });
    return;
  }

  try {
    const matches = await searchStations(query.trim());
    res.json(
      matches.map((m) => ({
        id: m.id,
        name: m.name,
        modes: m.modes,
      }))
    );
  } catch (err) {
    console.error("[stations/search] failed", err);
    res.status(502).json({ error: "Failed to search TfL stations" });
  }
});

// GET /stations/:id/arrivals — live "next train" predictions for a
// specific station, used by the departures board page.
stationsRouter.get("/:id/arrivals", async (req, res) => {
  try {
    const predictions = await getArrivals(req.params.id);
    res.json(
      predictions.map((p) => ({
        line: p.lineName,
        platform: p.platformName,
        destination: p.destinationName,
        minutesAway: Math.round(p.timeToStation / 60),
        secondsAway: p.timeToStation,
      }))
    );
  } catch (err) {
    console.error("[stations/:id/arrivals] failed", err);
    res.status(502).json({ error: "Failed to get live arrivals from TfL" });
  }
});
