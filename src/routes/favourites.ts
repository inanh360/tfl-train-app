import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/requireAuth";

export const favouritesRouter = Router();

favouritesRouter.use(requireAuth);

favouritesRouter.get("/", async (req, res) => {
  const favourites = await prisma.favourite.findMany({
    where: { userId: req.userId! },
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
        userId: req.userId!,
        favouriteType,
        refId,
      },
    },
    update: {},
    create: {
      userId: req.userId!,
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

  if (!favourite || favourite.userId !== req.userId) {
    res.status(404).json({ error: "Favourite not found" });
    return;
  }

  await prisma.favourite.delete({ where: { id: req.params.id } });
  res.status(204).send();
});
