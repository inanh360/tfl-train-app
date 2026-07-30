// One-off diagnostic script — not part of the app, just for debugging the
// favourites/notification test. Run with: npx tsx src/debug.ts
import { prisma } from "./lib/prisma";

async function main() {
  console.log("\n=== USERS ===");
  const users = await prisma.user.findMany();
  console.log(users);

  console.log("\n=== FAVOURITES ===");
  const favourites = await prisma.favourite.findMany();
  console.log(favourites);

  console.log("\n=== ACTIVE LINE STATUS EVENTS ===");
  const activeEvents = await prisma.lineStatusEvent.findMany({
    where: { isActive: true },
    include: { line: true, affectedStations: true },
  });
  console.log(
    activeEvents.map((e) => ({
      lineId: e.lineId,
      statusDescription: e.statusDescription,
      statusSeverity: e.statusSeverity,
      branchLabel: e.branchLabel,
      startedAt: e.startedAt,
    }))
  );

  console.log("\n=== NOTIFICATIONS ===");
  const notifications = await prisma.notification.findMany();
  console.log(notifications);

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
