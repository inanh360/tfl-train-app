import cron from "node-cron";
import { prisma } from "../lib/prisma";
import { fetchLineStatuses, normaliseLineStatuses } from "./tflClient";
import type { NormalisedLineStatus } from "../types/tfl";
import { notifyStatusChange } from "./notificationService";

// A key that identifies one (line, status, reason) triple, so simultaneous
// disruptions on the same line with the same severity label (e.g. two
// branches both "Minor Delays" for different reasons) are tracked as
// distinct events rather than colliding into one.
function statusKey(s: Pick<NormalisedLineStatus, "lineId" | "statusDescription" | "reason">): string {
  return `${s.lineId}::${s.statusDescription}::${s.reason ?? ""}`;
}

export async function pollOnce(): Promise<void> {
  const raw = await fetchLineStatuses();
  const current = normaliseLineStatuses(raw);

  // Make sure every line we've seen exists in the Line table before we
  // try to attach status events to it (foreign key requires it).
  await upsertLines(raw);

  const activeEvents = await prisma.lineStatusEvent.findMany({
    where: { isActive: true },
    include: { line: true },
  });

  const activeByKey = new Map(
    activeEvents.map((e) => [statusKey({ lineId: e.lineId, statusDescription: e.statusDescription }), e])
  );
  const currentByKey = new Map(current.map((s) => [statusKey(s), s]));

  // Close out any active DB row whose status is no longer being reported —
  // the line has moved on to a different status (or back to Good Service).
  const toClose = activeEvents.filter((e) => !currentByKey.has(statusKey(e)));
  if (toClose.length > 0) {
    await prisma.lineStatusEvent.updateMany({
      where: { id: { in: toClose.map((e) => e.id) } },
      data: { isActive: false, endedAt: new Date() },
    });
  }

  // Anything in the current TfL response that we don't already have an
  // active row for is a genuinely new status — insert it and fire a
  // notification.
  const toCreate = current.filter((s) => !activeByKey.has(statusKey(s)));

  for (const status of toCreate) {
    const event = await prisma.lineStatusEvent.create({
      data: {
        lineId: status.lineId,
        statusSeverity: status.statusSeverity,
        statusDescription: status.statusDescription,
        reason: status.reason,
        branchLabel: status.branchLabel,
        isActive: true,
        affectedStations: {
          create: status.affectedStations.map((s) => ({
            stationName: s.name,
            naptanId: s.naptanId,
          })),
        },
      },
      include: { affectedStations: true, line: true },
    });

    // Good Service (severity 10) isn't worth alerting on — only notify on
    // genuine degradation.
    if (status.statusSeverity < 10) {
      await notifyStatusChange(event);
    }
  }

  console.log(
    `[poll] ${new Date().toISOString()} — closed ${toClose.length}, created ${toCreate.length}, unchanged ${current.length - toCreate.length}`
  );
}

async function upsertLines(raw: Awaited<ReturnType<typeof fetchLineStatuses>>): Promise<void> {
  for (const line of raw) {
    await prisma.line.upsert({
      where: { id: line.id },
      update: { name: line.name, modeName: line.modeName },
      create: {
        id: line.id,
        name: line.name,
        modeName: line.modeName,
        colourHex: LINE_COLOURS[line.id] ?? "#666666",
      },
    });
  }
}

// TfL doesn't return brand colours in the status endpoint, so we keep our
// own lookup for the coloured line icons in the UI. Extend as you add DLR /
// Overground / Elizabeth line branch colours.
const LINE_COLOURS: Record<string, string> = {
  bakerloo: "#B36305",
  central: "#E32017",
  circle: "#FFD300",
  district: "#00782A",
  "hammersmith-city": "#F3A9BB",
  jubilee: "#A0A5A9",
  metropolitan: "#9B0056",
  northern: "#000000",
  piccadilly: "#003688",
  victoria: "#0098D4",
  "waterloo-city": "#95CDBA",
};

// Run as a standalone process: `npm run poll`
if (require.main === module) {
  const INTERVAL_CRON = process.env.POLL_CRON ?? "*/90 * * * * *"; // every 90s

  pollOnce().catch((err) => console.error("[poll] initial run failed", err));

  cron.schedule(INTERVAL_CRON, () => {
    pollOnce().catch((err) => console.error("[poll] run failed", err));
  });

  console.log(`[poll] scheduled with cron "${INTERVAL_CRON}"`);
}
