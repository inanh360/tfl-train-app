// Removes the fake event + notification created by test-notify.ts
import { prisma } from "./lib/prisma";

async function main() {
  const eventId = process.argv[2];
  if (!eventId) {
    console.error("Usage: npx tsx src/cleanup-test.ts <lineStatusEventId>");
    process.exit(1);
  }

  await prisma.notification.deleteMany({ where: { lineStatusEventId: eventId } });
  await prisma.lineStatusEvent.delete({ where: { id: eventId } });

  console.log(`Deleted test event ${eventId} and its notifications`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
