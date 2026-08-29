import webpush from "web-push";
import { prisma } from "../lib/prisma";

const publicKey = process.env.VAPID_PUBLIC_KEY;
const privateKey = process.env.VAPID_PRIVATE_KEY;

if (publicKey && privateKey) {
  // The mailto: address is required by the push protocol so push
  // services (Google's, Mozilla's, Apple's) have a contact point if
  // something's wrong with how the server is sending pushes, it isn't
  // shown to the person receiving the notification.
  webpush.setVapidDetails("mailto:admin@linestatus.co.uk", publicKey, privateKey);
} else {
  console.warn("[push] VAPID keys not set, push notifications are disabled");
}

// Sends a push notification to every device a user has subscribed on.
// Silently skips if VAPID keys aren't configured, rather than throwing,
// push is an enhancement on top of the existing in-app notifications, not
// something that should ever break the rest of the notification flow if
// it's misconfigured.
export async function sendPushToUser(userId: string, title: string, body: string): Promise<void> {
  if (!publicKey || !privateKey) return;

  const subscriptions = await prisma.pushSubscription.findMany({ where: { userId } });

  await Promise.all(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify({ title, body })
        );
      } catch (err: unknown) {
        // A 404 or 410 means the browser has invalidated this
        // subscription (uninstalled, permissions revoked, etc.), clean
        // it up rather than retrying it forever.
        const statusCode = (err as { statusCode?: number }).statusCode;
        if (statusCode === 404 || statusCode === 410) {
          await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
        } else {
          console.error(`[push] failed to send to subscription ${sub.id}`, err);
        }
      }
    })
  );
}
