import { Router } from "express";
import { searchStations } from "../services/tflClient";

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
