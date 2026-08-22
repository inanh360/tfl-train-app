import { Router } from "express";
import { searchBusStops, getArrivals, resolveBusStopDetails, findNearbyBusStops } from "../services/tflClient";

export const busRouter = Router();

// Bounds how many raw matches get resolved into real stops, since that's
// one additional TfL call per match — fine for a short dropdown list, not
// something to do for an unbounded number of matches. Each match can
// expand into more than one result if it turns out to be a grouped parent
// stop, so the final count can exceed this.
const MAX_RESOLVED_MATCHES = 8;

// Same reasoning as the train nearby-stations feature — see routes/nearby.ts.
const WALK_SPEED_METRES_PER_SECOND = 1.3;
const MAX_STOPS_TO_CHECK = 10;

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

// GET /bus/nearby?lat=&lon=&radius= — nearby bus stops and the soonest
// bus you could actually catch at each, accounting for walking time.
// Bus stops sit much closer together than train stations, so this
// defaults to a smaller radius than the train version.
busRouter.get("/nearby", async (req, res) => {
  const lat = Number(req.query.lat);
  const lon = Number(req.query.lon);
  const radius = req.query.radius ? Number(req.query.radius) : 500;

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    res.status(400).json({ error: "Query params 'lat' and 'lon' are required and must be numbers" });
    return;
  }

  try {
    const stops = (await findNearbyBusStops(lat, lon, radius)).slice(0, MAX_STOPS_TO_CHECK);

    const results = await Promise.all(
      stops.map(async (stop) => {
        const walkSeconds = stop.distance != null ? stop.distance / WALK_SPEED_METRES_PER_SECOND : 0;
        const walkMinutes = Math.round(walkSeconds / 60);

        let predictions: Awaited<ReturnType<typeof getArrivals>>;
        try {
          predictions = await getArrivals(stop.id);
        } catch {
          predictions = [];
        }

        const reachable = predictions.filter((p) => p.timeToStation >= walkSeconds);
        const bestReachable = reachable[0];

        return {
          id: stop.id,
          name: stop.commonName,
          lat: stop.lat ?? null,
          lon: stop.lon ?? null,
          distanceMetres: stop.distance ?? null,
          walkMinutes,
          nextBuses: predictions.slice(0, 5).map((p) => ({
            route: p.lineName,
            destination: p.destinationName,
            minutesAway: Math.round(p.timeToStation / 60),
          })),
          bestReachableMinutes: bestReachable ? Math.round(bestReachable.timeToStation / 60) : null,
        };
      })
    );

    // Stops with no live predictions at all aren't useful to show —
    // filtered out here rather than on the frontend, so the "best"
    // calculation below and the payload itself both only ever consider
    // stops that actually have something to offer.
    const withPredictions = results.filter((r) => r.nextBuses.length > 0);

    const withReachable = withPredictions.filter((r) => r.bestReachableMinutes !== null);
    const best =
      withReachable.length > 0
        ? withReachable.reduce((a, b) => (a.bestReachableMinutes! < b.bestReachableMinutes! ? a : b))
        : null;

    res.json({ stops: withPredictions, bestStopId: best?.id ?? null });
  } catch (err) {
    console.error("[bus/nearby] failed", err);
    res.status(502).json({ error: "Failed to find nearby bus stops via TfL" });
  }
});
