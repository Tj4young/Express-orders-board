import { recruiterDisplayName } from "./credit";
import { OFFICE_IDS, OFFICES } from "./offices";
import { isLostOrder } from "./status";
import { calendarDaysBetween, formatPhoenixISODate, isValidISODate, phoenixDayFromInstant } from "./time";
import type { BoardState, OfficeId } from "./types";

export type LostOrderRow = {
  orderId: string;
  /** ISO timestamp recorded when the order was marked competitor filled. */
  markedAt: string;
  /** Phoenix calendar month of markedAt, YYYY-MM. */
  month: string;
  office: OfficeId;
  officeName: string;
  client: string;
  position: string;
  openings: number;
  /** How many openings we had filled before the client pulled the order. */
  filled: number;
  recruiterName: string;
  /** Phoenix calendar days from date opened through the day it was marked. */
  daysOpen: number;
};

export function daysOnOrder(dateOpened: string, markedAt: string): number {
  if (!isValidISODate(dateOpened)) return 0;
  const markedDay = phoenixDayFromInstant(markedAt);
  if (!isValidISODate(markedDay)) return 0;
  return Math.max(0, calendarDaysBetween(dateOpened, markedDay));
}

export function formatMonthLabel(month: string): string {
  const match = /^(\d{4})-(\d{2})$/.exec(month);
  if (!match) return month;
  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, monthIndex, 1)));
}

export function lostOrderRows(state: BoardState): LostOrderRow[] {
  const rows: LostOrderRow[] = [];
  for (const order of state.orders) {
    if (!isLostOrder(order) || !order.competitorFilledAt) continue;
    const markedDay = phoenixDayFromInstant(order.competitorFilledAt);
    rows.push({
      orderId: order.id,
      markedAt: order.competitorFilledAt,
      month: markedDay.slice(0, 7),
      office: order.office,
      officeName: OFFICES[order.office].short,
      client: order.client,
      position: order.position,
      openings: order.openings,
      filled: order.filled,
      recruiterName: recruiterDisplayName(state, order.recruiterId),
      daysOpen: daysOnOrder(order.dateOpened, order.competitorFilledAt),
    });
  }
  rows.sort((a, b) => b.markedAt.localeCompare(a.markedAt) || a.client.localeCompare(b.client));
  return rows;
}

export function filterLostRows(rows: LostOrderRow[], month: string): LostOrderRow[] {
  if (!month || month === "all") return rows;
  return rows.filter((row) => row.month === month);
}

/** Months that have a pull, plus the current Phoenix month, newest first. */
export function lostMonths(rows: LostOrderRow[], now: Date | null, selected = "all"): string[] {
  const keys = new Set(rows.map((row) => row.month));
  if (now) keys.add(formatPhoenixISODate(now).slice(0, 7));
  if (selected && selected !== "all") keys.add(selected);
  return [...keys].sort((a, b) => b.localeCompare(a));
}

export function lostOfficeTotals(rows: LostOrderRow[]): { office: OfficeId; name: string; count: number }[] {
  return OFFICE_IDS.map((office) => ({
    office,
    name: OFFICES[office].name,
    count: rows.filter((row) => row.office === office).length,
  }));
}

export function lostClientTotals(rows: LostOrderRow[]): { client: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const row of rows) counts.set(row.client, (counts.get(row.client) ?? 0) + 1);
  return [...counts.entries()]
    .map(([client, count]) => ({ client, count }))
    .sort((a, b) => b.count - a.count || a.client.localeCompare(b.client));
}

function csvCell(value: string | number): string {
  let text = String(value);
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

const CSV_COLUMNS = [
  "Date marked",
  "Office",
  "Client",
  "Position",
  "Openings",
  "Filled before pulled",
  "Recruiter",
  "Days open",
] as const;

export function lostOrdersCsv(rows: LostOrderRow[]): string {
  const lines = [CSV_COLUMNS.join(",")];
  for (const row of rows) {
    lines.push(
      [
        row.markedAt,
        row.officeName,
        row.client,
        row.position,
        row.openings,
        row.filled,
        row.recruiterName,
        row.daysOpen,
      ]
        .map(csvCell)
        .join(","),
    );
  }
  return `${lines.join("\r\n")}\r\n`;
}
