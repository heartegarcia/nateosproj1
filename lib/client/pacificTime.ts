const PACIFIC_TZ = "America/Los_Angeles";

const dateFmt = new Intl.DateTimeFormat("en-US", {
  timeZone: PACIFIC_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const timeFmt = new Intl.DateTimeFormat("en-US", {
  timeZone: PACIFIC_TZ,
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

function partsToMap(parts: Intl.DateTimeFormatPart[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const p of parts) map[p.type] = p.value;
  return map;
}

/** Genie's timesheet runs on Pacific time regardless of where she's physically logging in from. */
export function pacificDateISO(date: Date = new Date()): string {
  const { year, month, day } = partsToMap(dateFmt.formatToParts(date));
  return `${year}-${month}-${day}`;
}

export function pacificTimeHM(date: Date = new Date()): string {
  const { hour, minute } = partsToMap(timeFmt.formatToParts(date));
  // Some ICU implementations render midnight as "24" with hour12:false.
  const h = hour === "24" ? "00" : hour;
  return `${h}:${minute}`;
}
