import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/requireAuth";

export const notificationsRouter = Router();

notificationsRouter.use(requireAuth);

// GET /notifications, the frontend polls this (React Query refetchInterval)
// to show new in-app alerts. Swap for a push subscription later without
// changing this contract.
notificationsRouter.get("/", async (req, res) => {
  const unreadOnly = req.query.unread === "true";

  const notifications = await prisma.notification.findMany({
    where: {
      userId: req.userId!,
      ...(unreadOnly ? { read: false } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  res.json(notifications);
});

notificationsRouter.post("/:id/read", async (req, res) => {
  const notification = await prisma.notification.findUnique({ where: { id: req.params.id } });

  if (!notification || notification.userId !== req.userId) {
    res.status(404).json({ error: "Notification not found" });
    return;
  }

  await prisma.notification.update({ where: { id: req.params.id }, data: { read: true } });
  res.status(204).send();
});

// POST /notifications/read-all, marks every unread notification as read
// for the signed in user. Scoped to req.userId in the query itself, same
// pattern as the DELETE route below, so there's no way this could ever
// touch another user's rows.
notificationsRouter.post("/read-all", async (req, res) => {
  await prisma.notification.updateMany({ where: { userId: req.userId!, read: false }, data: { read: true } });
  res.status(204).send();
});

// DELETE /notifications, clears every notification for the signed in
// user. Scoped to req.userId in the query itself, not just checked
// afterward, so there's no way this could ever touch another user's rows.
notificationsRouter.delete("/", async (req, res) => {
  await prisma.notification.deleteMany({ where: { userId: req.userId! } });
  res.status(204).send();
});
