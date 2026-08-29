import { Router } from "express";
import { prisma } from "../lib/prisma";
import { getLineStopPoints, getLineBranches } from "../services/tflClient";

export const linesRouter = Router();

// GET /lines, every line with its current status, for the home screen.
linesRouter.get("/", async (_req, res) => {
  const lines = await prisma.line.findMany({
    include: {
      statusEvents: {
        where: { isActive: true },
        include: { affectedStations: true },
      },
    },
    orderBy: { name: "asc" },
  });
  res.json(lines);
});

// GET /lines/:id, single line detail, including recent status history.
linesRouter.get("/:id", async (req, res) => {
  const line = await prisma.line.findUnique({
    where: { id: req.params.id },
    include: {
      statusEvents: {
        orderBy: { startedAt: "desc" },
        take: 10,
        include: { affectedStations: true },
      },
    },
  });

  if (!line) {
    res.status(404).json({ error: "Line not found" });
    return;
  }

  res.json(line);
});

// GET /lines/:id/stations, full station list for this line, used by the
// dedicated per-line page.
linesRouter.get("/:id/stations", async (req, res) => {
  try {
    const stations = await getLineStopPoints(req.params.id);
    res.json(stations);
  } catch (err) {
    console.error("[lines/:id/stations] failed", err);
    res.status(502).json({ error: "Failed to load stations for this line" });
  }
});

// GET /lines/:id/branches, each named branch on this line (e.g. "Ealing
// Broadway <-> Epping"), with its stations start to finish, used by the
// per-line page to show a proper branch breakdown rather than one flat
// alphabetical-ish list.
linesRouter.get("/:id/branches", async (req, res) => {
  try {
    const branches = await getLineBranches(req.params.id);
    res.json(branches);
  } catch (err) {
    console.error("[lines/:id/branches] failed", err);
    res.status(502).json({ error: "Failed to load branches for this line" });
  }
});
