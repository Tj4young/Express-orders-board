const TZ = "America/Phoenix";

export function formatPhoenixISODate(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function phoenixWeekday(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    weekday: "short",
  }).format(date);
}

/** Monday-based index for a Phoenix calendar day: Monday = 0 … Sunday = 6. */
export function phoenixMondayIndex(date: Date): number {
  const weekday = phoenixWeekday(date);
  const map: Record<string, number> = {
    Mon: 0,
    Tue: 1,
    Wed: 2,
    Thu: 3,
    Fri: 4,
    Sat: 5,
    Sun: 6,
  };
  const index = map[weekday];
  if (index === undefined) {
    throw new Error(`Unexpected weekday from Intl: ${weekday}`);
  }
  return index;
}

export function addDays(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day));
  utc.setUTCDate(utc.getUTCDate() + days);
  return utc.toISOString().slice(0, 10);
}

export function startOfPhoenixWeek(now: Date): string {
  const today = formatPhoenixISODate(now);
  return addDays(today, -phoenixMondayIndex(now));
}

export function startOfPhoenixMonth(now: Date): string {
  const today = formatPhoenixISODate(now);
  return `${today.slice(0, 7)}-01`;
}

export function phoenixDayFromInstant(isoTimestamp: string): string {
  return formatPhoenixISODate(new Date(isoTimestamp));
}

export function calendarDaysBetween(earlierDay: string, laterDay: string): number {
  const [y1, m1, d1] = earlierDay.split("-").map(Number);
  const [y2, m2, d2] = laterDay.split("-").map(Number);
  const a = Date.UTC(y1, m1 - 1, d1);
  const b = Date.UTC(y2, m2 - 1, d2);
  return Math.round((b - a) / 86_400_000);
}

export function isValidISODate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day));
  return (
    utc.getUTCFullYear() === year &&
    utc.getUTCMonth() === month - 1 &&
    utc.getUTCDate() === day
  );
}

export function formatPrettyDate(isoDay: string): string {
  const [year, month, day] = isoDay.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

export function formatPrettyDateTime(isoTimestamp: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(isoTimestamp));
}

export function formatClock(isoTimestamp: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(isoTimestamp));
}

export type Period = {
  start: string;
  end: string;
};

export function currentPeriods(now: Date): { week: Period; month: Period; today: string } {
  const today = formatPhoenixISODate(now);
  return {
    today,
    week: { start: startOfPhoenixWeek(now), end: today },
    month: { start: startOfPhoenixMonth(now), end: today },
  };
}

export function dayInPeriod(day: string, period: Period): boolean {
  return day >= period.start && day <= period.end;
}

/** Orders still open this many calendar days pick up the aging treatment. */
export const AGING_DAYS = 14;

export function isAging(dateOpened: string, today: string, dateFilled: string | null): boolean {
  if (dateFilled) return false;
  return calendarDaysBetween(dateOpened, today) >= AGING_DAYS;
}
