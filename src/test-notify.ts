// One-off test script, manually creates a fake "Minor Delays" event on the
// Circle line and runs it through notifyStatusChange, so we can verify the
// favourites -> notification path works without depending on a real,
// currently-active TfL disruption. Run with: npx tsx src/test-notify.ts
import { prisma } from "./lib/prisma";
import { notifyStatusChange } from "./services/notificationService";

async function main() {
  const event = await prisma.lineStatusEvent.create({
    data: {
      lineId: "circle",
      statusSeverity: 9,
      statusDescription: "Minor Delays",
      reason: "TEST: Circle Line: Minor delays due to train cancellations.",
      branchLabel: null,
      isActive: true,
    },
    include: { line: true, affectedStations: true },
  });

  console.log("Created test event:", event.id);

  await notifyStatusChange(event);

  const notifications = await prisma.notification.findMany({
    where: { lineStatusEventId: event.id },
  });

  console.log("\n=== NOTIFICATIONS CREATED FOR THIS TEST EVENT ===");
  console.log(notifications);

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
