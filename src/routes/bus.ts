import { Router } from "express";
import { searchBusStops, getArrivals, resolveBusStopDetails } from "../services/tflClient";

export const busRouter = Router();

// Bounds how many raw matches get resolved into real stops, since that's
// one additional TfL call per match — fine for a short dropdown list, not
// something to do for an unbounded number of matches. Each match can
// expand into more than one result if it turns out to be a grouped parent
// stop, so the final count can exceed this.
const MAX_RESOLVED_MATCHES = 8;

// GET /bus/search?q=oxford — bus stop search, kept entirely separate from
// /stations/search (train modes only), since this app deliberately treats
// buses as their own distinct section rather than mixing modes.
busRouter.get("/search", async (req, res) => {
  const query = req.query.q;

  if (typeof query !== "string" || query.trim().length < 2) {
    res.status(400).json({ error: "Query param 'q' must be at least 2 characters" });
    return;
  }

  try {
    const matches = (await searchBusStops(query.trim())).slice(0, MAX_RESOLVED_MATCHES);
    const resolvedGroups = await Promise.all(matches.map((m) => resolveBusStopDetails(m.id)));
    res.json(resolvedGroups.flat());
  } catch (err) {
    console.error("[bus/search] failed", err);
    res.status(502).json({ error: "Failed to search TfL bus stops" });
  }
});

// GET /bus/:id/times — live "next bus" predictions for a specific stop.
// Reuses the same getArrivals function as the train departures board,
// since TfL's arrivals endpoint isn't mode specific, it just returns
// whatever's predicted for the given stop id.
busRouter.get("/:id/times", async (req, res) => {
  try {
    const predictions = await getArrivals(req.params.id);
    res.json(
      predictions.map((p) => ({
        route: p.lineName,
        destination: p.destinationName,
        minutesAway: Math.round(p.timeToStation / 60),
        secondsAway: p.timeToStation,
      }))
    );
  } catch (err) {
    console.error("[bus/:id/times] failed", err);
    res.status(502).json({ error: "Failed to get live bus times from TfL" });
  }
});
