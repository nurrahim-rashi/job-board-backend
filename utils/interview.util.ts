const zonedParts = (date: Date, timeZone: string) => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);

  const read = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value);

  return {
    year: read("year"),
    month: read("month"),
    day: read("day"),
    hour: read("hour"),
    minute: read("minute"),
    second: read("second"),
  };
};

const zoneOffsetMs = (date: Date, timeZone: string): number => {
  const { year, month, day, hour, minute, second } = zonedParts(date, timeZone);
  const wallClock = Date.UTC(year, month - 1, day, hour, minute, second);

  return wallClock - Math.floor(date.getTime() / 1000) * 1000;
};

export const zonedDayStart = (
  date: Date,
  timeZone: string,
  dayOffset: number,
): Date => {
  const { year, month, day } = zonedParts(date, timeZone);
  const wallClock = Date.UTC(year, month - 1, day + dayOffset);

  const firstPass = new Date(wallClock - zoneOffsetMs(date, timeZone));

  return new Date(wallClock - zoneOffsetMs(firstPass, timeZone));
};

/**
 * A "YYYY-MM-DD" filter means that calendar day where the user is, not in UTC.
 * Parsing it as UTC shifts the boundary by the zone offset, which in WIB
 * (UTC+7) pulls in postings made early the following morning.
 */
export const zonedDateRangeBound = (
  isoDate: string,
  timeZone: string,
  edge: "start" | "end",
): Date => {
  const [year, month, day] = isoDate.split("-").map(Number);
  if (!year || !month || !day) return new Date(Number.NaN);

  const midnightUtc = new Date(Date.UTC(year, month - 1, day));
  const start = zonedDayStart(midnightUtc, timeZone, 0);
  if (edge === "start") return start;

  return new Date(zonedDayStart(midnightUtc, timeZone, 1).getTime() - 1);
};
