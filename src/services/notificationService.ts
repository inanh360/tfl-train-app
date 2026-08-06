import { prisma } from "../lib/prisma";
import type { LineStatusEvent, AffectedStation, Line } from "@prisma/client";

type EventWithRelations = LineStatusEvent & {
  line: Line;
  affectedStations: AffectedStation[];
};

// TfL's affectedRoutes name often reads like "Epping Underground Station -
// West Ruislip Underground Station" — strip the repeated station-type
// suffixes so it displays as "Epping - West Ruislip".
function cleanBranchLabel(raw: string): string {
  return raw
    .split(" - ")
    .map((part) => part.replace(/\s*(Underground|Rail|DLR)?\s*Station$/i, "").trim())
    .join(" - ");
}

// Some TfL line names already end in "line" (lowercase, e.g. "Elizabeth
// line"), so blindly appending " Line" produces "Elizabeth line Line".
// This normalises to a consistent "X Line" display form regardless of how
// TfL capitalised the source name.
function displayLineName(rawName: string): string {
  const stripped = rawName.replace(/\s*line$/i, "").trim();
  return `${stripped} Line`;
}

// Builds the three copy variants from the scope doc:
//   "X Line is down!"      -> severity <= 3 (Suspended / Part Suspended)
//   "X Line is delayed!"   -> severity 4-9 (Minor/Severe Delays etc.)
//   "X station is down!"   -> line status carries specific affected stations
//
// When TfL gives us a branch label (e.g. "Hainault via Newbury Park"), we
// fold it into the line name so simultaneous branch-specific disruptions
// read as distinct alerts rather than duplicate "Central Line is delayed"
// messages. TfL doesn't always populate this field, so there's a fallback
// to the plain line name when it's missing.
function buildMessage(event: EventWithRelations): string {
  const baseLineName = displayLineName(event.line.name);
  const lineName = event.branchLabel
    ? `${baseLineName} (${cleanBranchLabel(event.branchLabel)})`
    : baseLineName;

  if (event.affectedStations.length > 0) {
    const stationList = event.affectedStations.map((s) => s.stationName).join(", ");
    return `${stationList} ${event.affectedStations.length > 1 ? "are" : "is"} down! Want to plan your journey?`;
  }

  if (event.statusSeverity <= 3) {
    return `${lineName} is down! Want to plan your journey?`;
  }

  return `${lineName} is delayed! Want to plan your journey?`;
}

// In-app delivery: write a Notification-shaped row that the frontend polls
// (or subscribes to via Supabase realtime later). Swap the body of this
// function for a Web Push send when you move to push notifications — the
// call site in pollingService.ts doesn't need to change.
export async function notifyStatusChange(event: EventWithRelations): Promise<void> {
  const message = buildMessage(event);

  // Only notify users who've favourited this line, or one of the affected
  // stations.
  const stationRefIds = event.affectedStations.map((s) => s.naptanId ?? s.stationName);

  const interestedFavourites = await prisma.favourite.findMany({
    where: {
      OR: [
        { favouriteType: "LINE", refId: event.lineId },
        ...(stationRefIds.length > 0
          ? [{ favouriteType: "STATION" as const, refId: { in: stationRefIds } }]
          : []),
      ],
    },
  });

  for (const fav of interestedFavourites) {
    await prisma.notification.create({
      data: {
        userId: fav.userId,
        lineStatusEventId: event.id,
        message,
        colourHex: event.line.colourHex,
        read: false,
      },
    });
  }

  await prisma.lineStatusEvent.update({
    where: { id: event.id },
    data: { notificationSent: true },
  });

  console.log(`[notify] ${message} -> ${interestedFavourites.length} favourited user(s)`);
}
