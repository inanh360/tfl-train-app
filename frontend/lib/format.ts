// TfL's branch data often reads like "Epping Underground Station - West
// Ruislip Underground Station", this strips the repeated station-type
// suffixes so it displays as "Epping - West Ruislip". Mirrors the same
// cleanup used in the backend's notification messages, so the wording is
// consistent between an alert and what's shown on the dashboard.
export function cleanBranchLabel(raw: string): string {
  return raw
    .split(" - ")
    .map((part) => part.replace(/\s*(Underground|Rail|DLR)?\s*Station$/i, "").trim())
    .join(" - ");
}
