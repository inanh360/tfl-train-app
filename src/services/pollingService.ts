import { prisma } from "../lib/prisma";
import { fetchLineStatuses, normaliseLineStatuses } from "./tflClient";
import type { NormalisedLineStatus } from "../types/tfl";
import { notifyStatusChange } from "./notificationService";

// A key that identifies one (line, status, distinguishing-detail) triple,
// so simultaneous disruptions on the same line with the same severity
// label (e.g. two branches both "Minor Delays" for different reasons) are
// tracked as distinct events rather than colliding. Prefers the structured
// branchLabel over the free-text reason where available, since reason
// wording can vary slightly between polls for the same underlying
// disruption in a way that would otherwise look like a "new" event.
function statusKey(
  s: Pick<NormalisedLineStatus, "lineId" | "statusDescription" | "reason" | "branchLabel">
): string {
  return `${s.lineId}::${s.statusDescription}::${s.branchLabel ?? s.reason ?? ""}`;
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
    activeEvents.map((e) => [
      statusKey({
        lineId: e.lineId,
        statusDescription: e.statusDescription,
        reason: e.reason,
        branchLabel: e.branchLabel,
      }),
      e,
    ])
  );
  const currentByKey = new Map(current.map((s) => [statusKey(s), s]));

  // Close out any active DB row whose status is no longer being reported,
  // the line has moved on to a different status (or back to Good Service).
  const toClose = activeEvents.filter((e) => !currentByKey.has(statusKey(e)));
  if (toClose.length > 0) {
    await prisma.lineStatusEvent.updateMany({
      where: { id: { in: toClose.map((e) => e.id) } },
      data: { isActive: false, endedAt: new Date() },
    });
  }

  // Anything in the current TfL response that we don't already have an
  // active row for is a genuinely new status, insert it and fire a
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

    // Good Service (severity 10) isn't worth alerting on, only notify on
    // genuine degradation.
    if (status.statusSeverity < 10) {
      await notifyStatusChange(event);
    }
  }

  console.log(
    `[poll] ${new Date().toISOString()}, closed ${toClose.length}, created ${toCreate.length}, unchanged ${current.length - toCreate.length}`
  );
}

async function upsertLines(raw: Awaited<ReturnType<typeof fetchLineStatuses>>): Promise<void> {
  for (const line of raw) {
    await prisma.line.upsert({
      where: { id: line.id },
      update: { name: line.name, modeName: line.modeName, colourHex: LINE_COLOURS[line.id] ?? "#666666" },
      create: {
        id: line.id,
        name: line.name,
        modeName: line.modeName,
        colourHex: LINE_COLOURS[line.id] ?? "#666666",
      },
    });
  }
}

// Official TfL colour standard, Issue 10 (May 2025), converted from the
// RGB values in TfL's own published colour standard document rather than
// approximated. TfL's status API doesn't return brand colours itself, so
// this lookup is what drives the coloured line swatches in the UI.
const LINE_COLOURS: Record<string, string> = {
  // London Underground
  bakerloo: "#B26300",
  central: "#DC241F",
  circle: "#FFC80A",
  district: "#007D32",
  "hammersmith-city": "#F589A6",
  jubilee: "#838D93",
  metropolitan: "#9B0058",
  northern: "#000000",
  piccadilly: "#0019A8",
  victoria: "#039BE5",
  "waterloo-city": "#76D0BD",
  // Other TfL rail modes
  dlr: "#00AFAD",
  elizabeth: "#60399E",
  // London Overground, renamed and recoloured November 2024
  liberty: "#5D6061",
  lioness: "#FAA61A",
  mildmay: "#0077AD",
  suffragette: "#5BBD72",
  weaver: "#823A62",
  windrush: "#ED1B00",
};

// Run as a standalone process: `npm run poll`
if (require.main === module) {
  const INTERVAL_MS = Number(process.env.POLL_INTERVAL_MS ?? 90_000);

  // Guards against overlapping runs: if a poll is still writing to the DB
  // when the next tick fires (e.g. a slow network response, or a bad
  // interval value), we skip that tick rather than starting a second
  // pollOnce() concurrently, running two at once was exactly what caused
  // duplicate notifications earlier.
  let isPolling = false;

  const runPoll = async () => {
    if (isPolling) {
      console.warn("[poll] previous run still in progress, skipping this tick");
      return;
    }
    isPolling = true;
    try {
      await pollOnce();
    } catch (err) {
      console.error("[poll] run failed", err);
    } finally {
      isPolling = false;
    }
  };

  runPoll();
  setInterval(runPoll, INTERVAL_MS);

  console.log(`[poll] scheduled every ${INTERVAL_MS}ms`);
}
