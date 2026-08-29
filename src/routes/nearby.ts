import { Router } from "express";
import { findNearbyStations, getArrivals } from "../services/tflClient";

export const nearbyRouter = Router();

// Rough average walking pace. TfL's own distance figure is straight-line
// (and based on lat/lon truncated to 3 decimal places per TfL's own forum
// notes), not a real walking route, so this whole calculation is a
// reasonable estimate, not survey-accurate, worth stating plainly rather
// than implying more precision than the underlying data actually has.
const WALK_SPEED_METRES_PER_SECOND = 1.3;
const MAX_STATIONS_TO_CHECK = 6;

interface StationResult {
  id: string;
  name: string;
  lat: number | null;
  lon: number | null;
  distanceMetres: number | null;
  walkMinutes: number;
  nextTrains: { line: string; destination: string; minutesAway: number }[];
  // The soonest train this station's arrivals actually let you catch,
  // accounting for the fact that you can't catch a train that arrives
  // before you've finished walking there. Null if nothing currently
  // predicted is reachable on foot.
  bestReachableMinutes: number | null;
}

// GET /nearby?lat=&lon=&radius=
// Finds nearby train stations and, for each, the soonest train you could
// actually catch once you've walked there, not just the soonest train
// listed, since a 2-minute train at a station 8 minutes away isn't
// catchable at all.
nearbyRouter.get("/", async (req, res) => {
  const lat = Number(req.query.lat);
  const lon = Number(req.query.lon);
  const radius = req.query.radius ? Number(req.query.radius) : 2000;

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    res.status(400).json({ error: "Query params 'lat' and 'lon' are required and must be numbers" });
    return;
  }

  try {
    const stations = (await findNearbyStations(lat, lon, radius)).slice(0, MAX_STATIONS_TO_CHECK);

    const results: StationResult[] = await Promise.all(
      stations.map(async (station) => {
        const walkSeconds = station.distance != null ? station.distance / WALK_SPEED_METRES_PER_SECOND : 0;
        const walkMinutes = Math.round(walkSeconds / 60);

        let predictions: Awaited<ReturnType<typeof getArrivals>>;
        try {
          predictions = await getArrivals(station.id);
        } catch {
          predictions = []; // one station's arrivals failing shouldn't break the whole response
        }

        const reachable = predictions.filter((p) => p.timeToStation >= walkSeconds);
        const bestReachable = reachable[0]; // already sorted soonest-first by getArrivals

        return {
          id: station.id,
          name: station.commonName,
          lat: station.lat ?? null,
          lon: station.lon ?? null,
          distanceMetres: station.distance ?? null,
          walkMinutes,
          nextTrains: predictions.slice(0, 5).map((p) => ({
            line: p.lineName,
            destination: p.destinationName,
            minutesAway: Math.round(p.timeToStation / 60),
          })),
          bestReachableMinutes: bestReachable ? Math.round(bestReachable.timeToStation / 60) : null,
        };
      })
    );

    // Best overall: lowest total time (walk + wait) among stations that
    // actually have a catchable train right now.
    const withReachable = results.filter((r) => r.bestReachableMinutes !== null);
    const best =
      withReachable.length > 0
        ? withReachable.reduce((a, b) => (a.bestReachableMinutes! < b.bestReachableMinutes! ? a : b))
        : null;

    res.json({ stations: results, bestStationId: best?.id ?? null });
  } catch (err) {
    console.error("[nearby] failed", err);
    res.status(502).json({ error: "Failed to find nearby stations via TfL" });
  }
});
