import { addDays, formatPrettyDate, formatPhoenixISODate, phoenixDayFromInstant } from "./time";
import type { BoardState, OfficeId } from "./types";

export type DayFill = { day: string; label: string; count: number };

export function recentFillDays(state: BoardState, now: Date, days = 14, office?: OfficeId): DayFill[] {
  const today = formatPhoenixISODate(now);
  const buckets: DayFill[] = [];
  for (let ago = days - 1; ago >= 0; ago -= 1) {
    const day = addDays(today, -ago);
    const count = state.fillEvents.filter((event) => {
      if (office && event.office !== office) return false;
      return phoenixDayFromInstant(event.at) === day;
    }).length;
    buckets.push({ day, label: formatPrettyDate(day), count });
  }
  return buckets;
}
