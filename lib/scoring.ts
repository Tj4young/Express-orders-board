import { contributorNames, formatNameList } from "./credit";
import { OFFICES } from "./offices";
import {
  currentPeriods,
  dayInPeriod,
  formatPrettyDate,
  phoenixDayFromInstant,
  type Period,
} from "./time";
import { isOpenOrder } from "./status";
import type { BoardState, FillEvent, OfficeId, Order } from "./types";

export type OfficeScore = {
  office: OfficeId;
  name: string;
  weekHeads: number;
  weekOrders: number;
  weekFillRate: number | null;
  monthHeads: number;
  monthOrders: number;
  monthFillRate: number | null;
};

export type RecruiterRank = {
  recruiterId: string;
  name: string;
  office: OfficeId;
  monthHeads: number;
  weekHeads: number;
};

export type RecentWin = {
  orderId: string;
  office: OfficeId;
  officeName: string;
  client: string;
  position: string;
  recruiterName: string;
  at: string;
};

export type Scoreboard = {
  tempe: OfficeScore;
  mesa: OfficeScore;
  /** Month heads, then month orders, then month fill rate. */
  leader: OfficeId | "tie";
  recruiters: RecruiterRank[];
  recentWins: RecentWin[];
};

/** One order's fills credited to a recruiter during the leaderboard month. */
export type RecruiterPlacement = {
  orderId: string;
  client: string;
  position: string;
  office: OfficeId;
  officeName: string;
  logo: string | null;
  /** Fill events for this recruiter on this order during the period. */
  count: number;
  latestAt: string;
  earliestAt: string;
  /** Phoenix calendar day of the earliest credited fill in the period. */
  earliestDay: string;
  /** Phoenix calendar day of the latest credited fill in the period. */
  latestDay: string;
};

/**
 * A competitor pull ends the order the way a fill does, but it is not a close.
 * Counting it as worked for that period keeps fill rate from jumping up.
 * After the period it drops out, so it does not drag later months.
 */
function workedInPeriod(order: Order, period: Period): boolean {
  if (order.dateOpened > period.end) return false;
  const ended = order.dateFilled
    ? phoenixDayFromInstant(order.dateFilled)
    : order.competitorFilledAt
      ? phoenixDayFromInstant(order.competitorFilledAt)
      : null;
  if (!ended) return true;
  return ended >= period.start;
}

function filledInPeriod(order: Order, period: Period): boolean {
  if (!order.dateFilled) return false;
  return dayInPeriod(phoenixDayFromInstant(order.dateFilled), period);
}

function fillRate(orders: Order[], office: OfficeId, period: Period): number | null {
  const worked = orders.filter((order) => order.office === office && workedInPeriod(order, period));
  if (worked.length === 0) return null;
  const filled = worked.filter((order) => filledInPeriod(order, period)).length;
  return filled / worked.length;
}

function heads(state: BoardState, office: OfficeId, period: Period): number {
  return state.fillEvents.filter(
    (event) => event.office === office && dayInPeriod(phoenixDayFromInstant(event.at), period),
  ).length;
}

/** The same fill events the recruiter leaderboard counts for a period. */
function creditedInPeriod(state: BoardState, recruiterId: string, period: Period): FillEvent[] {
  const credited: FillEvent[] = [];
  for (const event of state.fillEvents) {
    if (event.recruiterId !== recruiterId) continue;
    if (!dayInPeriod(phoenixDayFromInstant(event.at), period)) continue;
    credited.push(event);
  }
  return credited;
}

function placementsForPeriod(state: BoardState, recruiterId: string, period: Period): RecruiterPlacement[] {
  const groups = new Map<string, { count: number; latestAt: string; earliestAt: string; office: OfficeId }>();
  for (const event of creditedInPeriod(state, recruiterId, period)) {
    const current = groups.get(event.orderId);
    if (!current) {
      groups.set(event.orderId, { count: 1, latestAt: event.at, earliestAt: event.at, office: event.office });
      continue;
    }
    current.count += 1;
    if (event.at >= current.latestAt) {
      current.latestAt = event.at;
      current.office = event.office;
    }
    if (event.at < current.earliestAt) current.earliestAt = event.at;
  }

  const rows: RecruiterPlacement[] = [];
  for (const [orderId, group] of groups) {
    const order = state.orders.find((item) => item.id === orderId);
    const office = order?.office ?? group.office;
    rows.push({
      orderId,
      client: order?.client ?? "Order no longer on the board",
      position: order?.position ?? "",
      office,
      officeName: OFFICES[office].short,
      logo: order?.logo ?? null,
      count: group.count,
      latestAt: group.latestAt,
      earliestAt: group.earliestAt,
      earliestDay: phoenixDayFromInstant(group.earliestAt),
      latestDay: phoenixDayFromInstant(group.latestAt),
    });
  }
  rows.sort(
    (a, b) =>
      b.latestAt.localeCompare(a.latestAt) ||
      a.client.localeCompare(b.client) ||
      a.position.localeCompare(b.position) ||
      a.orderId.localeCompare(b.orderId),
  );
  return rows;
}

/**
 * Placements behind a leaderboard number for the current Arizona month.
 * Grouped by order, most recent fill first. Reopening a job or marking it
 * competitor filled does not remove these fill events.
 */
export function recruiterPlacements(state: BoardState, recruiterId: string, now: Date): RecruiterPlacement[] {
  return placementsForPeriod(state, recruiterId, currentPeriods(now).month);
}

/** "Nov 18", or "Nov 4 – Nov 12" when one order's fills span more than a day. */
export function formatPlacementWhen(row: Pick<RecruiterPlacement, "earliestDay" | "latestDay">): string {
  if (row.earliestDay === row.latestDay) return formatPrettyDate(row.latestDay);
  return `${formatPrettyDate(row.earliestDay)} – ${formatPrettyDate(row.latestDay)}`;
}

function ordersFilled(orders: Order[], office: OfficeId, period: Period): number {
  return orders.filter((order) => order.office === office && filledInPeriod(order, period)).length;
}

function officeScore(state: BoardState, office: OfficeId, week: Period, month: Period): OfficeScore {
  return {
    office,
    name: OFFICES[office].name,
    weekHeads: heads(state, office, week),
    weekOrders: ordersFilled(state.orders, office, week),
    weekFillRate: fillRate(state.orders, office, week),
    monthHeads: heads(state, office, month),
    monthOrders: ordersFilled(state.orders, office, month),
    monthFillRate: fillRate(state.orders, office, month),
  };
}

function compareLeader(a: OfficeScore, b: OfficeScore): number {
  if (a.monthHeads !== b.monthHeads) return b.monthHeads - a.monthHeads;
  if (a.monthOrders !== b.monthOrders) return b.monthOrders - a.monthOrders;
  const aRate = a.monthFillRate ?? -1;
  const bRate = b.monthFillRate ?? -1;
  if (aRate !== bRate) return bRate - aRate;
  return 0;
}

export function scoreBoard(state: BoardState, now: Date): Scoreboard {
  const { week, month } = currentPeriods(now);
  const tempe = officeScore(state, "tempe", week, month);
  const mesa = officeScore(state, "mesa", week, month);
  const comparison = compareLeader(tempe, mesa);
  const leader: OfficeId | "tie" = comparison === 0 ? "tie" : comparison < 0 ? "tempe" : "mesa";

  const recruiters: RecruiterRank[] = state.recruiters
    .map((recruiter) => ({
      recruiterId: recruiter.id,
      name: recruiter.name,
      office: recruiter.office,
      monthHeads: creditedInPeriod(state, recruiter.id, month).length,
      weekHeads: creditedInPeriod(state, recruiter.id, week).length,
    }))
    .sort((a, b) => b.monthHeads - a.monthHeads || b.weekHeads - a.weekHeads || a.name.localeCompare(b.name));

  const recentWins: RecentWin[] = state.orders
    .filter((order) => order.dateFilled)
    .sort((a, b) => (b.dateFilled ?? "").localeCompare(a.dateFilled ?? ""))
    .slice(0, 16)
    .map((order) => ({
      orderId: order.id,
      office: order.office,
      officeName: OFFICES[order.office].name,
      client: order.client,
      position: order.position,
      recruiterName: formatNameList(contributorNames(state, order.id)),
      at: order.dateFilled as string,
    }));

  return { tempe, mesa, leader, recruiters, recentWins };
}

export function formatRate(rate: number | null): string {
  if (rate === null) return "—";
  return `${Math.round(rate * 100)}%`;
}

export function plural(count: number, singular: string, pluralForm = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}

export function activeOrders(state: BoardState, office?: OfficeId): Order[] {
  return state.orders.filter((order) => isOpenOrder(order) && (!office || order.office === office));
}

export function wins(state: BoardState, office?: OfficeId): Order[] {
  return state.orders
    .filter((order) => order.dateFilled && (!office || order.office === office))
    .sort((a, b) => (b.dateFilled ?? "").localeCompare(a.dateFilled ?? ""));
}
