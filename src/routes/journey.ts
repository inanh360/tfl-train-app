import { Router } from "express";
import { planJourney } from "../services/tflClient";

export const journeyRouter = Router();

// GET /journey?from=<stopPointId>&to=<stopPointId>
// Wraps TfL's Journey Planner, forced to train modes only, and returns a
// trimmed-down shape — the raw TfL response carries a lot (fares, obstacle
// data, lat/lon path strings) the frontend doesn't need for a simple
// train-only planner.
journeyRouter.get("/", async (req, res) => {
  const { from, to } = req.query;

  if (typeof from !== "string" || typeof to !== "string") {
    res.status(400).json({ error: "Query params 'from' and 'to' (StopPoint ids) are required" });
    return;
  }

  try {
    const result = await planJourney(from, to);

    const journeys = result.journeys.map((journey) => ({
      startTime: journey.startDateTime,
      arrivalTime: journey.arrivalDateTime,
      durationMinutes: journey.duration,
      legs: journey.legs.map((leg) => ({
        mode: leg.mode.name,
        line: leg.routeOptions[0]?.lineIdentifier?.name ?? leg.mode.name,
        summary: leg.instruction.summary,
        from: leg.departurePoint.commonName,
        to: leg.arrivalPoint.commonName,
        departureTime: leg.departureTime,
        arrivalTime: leg.arrivalTime,
        durationMinutes: leg.duration,
        isDisrupted: leg.isDisrupted,
      })),
    }));

    res.json({ journeys });
  } catch (err) {
    console.error("[journey] failed", err);
    res.status(502).json({ error: "Failed to plan journey via TfL" });
  }
});
