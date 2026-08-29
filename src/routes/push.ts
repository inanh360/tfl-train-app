import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/requireAuth";

export const pushRouter = Router();

pushRouter.use(requireAuth);

// POST /push/subscribe, called after the browser grants notification
// permission and creates a push subscription. Stores just enough to send
// a push later: the endpoint (effectively "where to deliver it") and the
// two keys the browser generated for encrypting the payload.
pushRouter.post("/subscribe", async (req, res) => {
  const userId = req.userId as string;
  const { endpoint, keys } = req.body as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };

  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    res.status(400).json({ error: "Missing endpoint or keys in subscription" });
    return;
  }

  await prisma.pushSubscription.upsert({
    where: { endpoint },
    update: { userId, p256dh: keys.p256dh, auth: keys.auth },
    create: { userId, endpoint, p256dh: keys.p256dh, auth: keys.auth },
  });

  res.status(201).json({ ok: true });
});

// DELETE /push/subscribe, called when the user turns notifications off,
// or the browser reports the subscription is no longer valid.
pushRouter.delete("/subscribe", async (req, res) => {
  const { endpoint } = req.body as { endpoint?: string };
  if (!endpoint) {
    res.status(400).json({ error: "Missing endpoint" });
    return;
  }

  await prisma.pushSubscription.deleteMany({ where: { endpoint, userId: req.userId as string } });
  res.status(204).send();
});
