import { Router } from "express";
import { prisma } from "../lib/prisma";

export const favouritesRouter = Router();

// All routes here assume req.userId has been set by an auth middleware
// upstream. Swap in real auth (e.g. Supabase JWT verification) before
// shipping — for now this reads a header so the API is testable standalone.
favouritesRouter.use((req, res, next) => {
  const userId = req.header("x-user-id");
  if (!userId) {
    res.status(401).json({ error: "Missing x-user-id header (temporary auth stand-in)" });
    return;
  }
  (req as any).userId = userId;
  next();
});

favouritesRouter.get("/", async (req, res) => {
  const favourites = await prisma.favourite.findMany({
    where: { userId: (req as any).userId },
    orderBy: { createdAt: "desc" },
  });
  res.json(favourites);
});

favouritesRouter.post("/", async (req, res) => {
  const { favouriteType, refId, refLabel } = req.body;

  if (!favouriteType || !refId || !refLabel) {
    res.status(400).json({ error: "favouriteType, refId, and refLabel are required" });
    return;
  }

  const favourite = await prisma.favourite.upsert({
    where: {
      userId_favouriteType_refId: {
        userId: (req as any).userId,
        favouriteType,
        refId,
      },
    },
    update: {},
    create: {
      userId: (req as any).userId,
      favouriteType,
      refId,
      refLabel,
      ...(favouriteType === "LINE" ? { lineRefId: refId } : {}),
    },
  });

  res.status(201).json(favourite);
});

favouritesRouter.delete("/:id", async (req, res) => {
  const favourite = await prisma.favourite.findUnique({ where: { id: req.params.id } });

  if (!favourite || favourite.userId !== (req as any).userId) {
    res.status(404).json({ error: "Favourite not found" });
    return;
  }

  await prisma.favourite.delete({ where: { id: req.params.id } });
  res.status(204).send();
});
