import { OFFICES } from "./offices";
import {
  currentPeriods,
  dayInPeriod,
  phoenixDayFromInstant,
  type Period,
} from "./time";
import type { BoardState, OfficeId, Order } from "./types";

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

function workedInPeriod(order: Order, period: Period): boolean {
  if (order.dateOpened > period.end) return false;
  if (!order.dateFilled) return true;
  const filledDay = phoenixDayFromInstant(order.dateFilled);
  return filledDay >= period.start;
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
    .map((recruiter) => {
      const events = state.fillEvents.filter((event) => event.recruiterId === recruiter.id);
      return {
        recruiterId: recruiter.id,
        name: recruiter.name,
        office: recruiter.office,
        monthHeads: events.filter((event) => dayInPeriod(phoenixDayFromInstant(event.at), month)).length,
        weekHeads: events.filter((event) => dayInPeriod(phoenixDayFromInstant(event.at), week)).length,
      };
    })
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
      recruiterName: state.recruiters.find((recruiter) => recruiter.id === order.recruiterId)?.name ?? "Team",
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
  return state.orders.filter((order) => !order.dateFilled && (!office || order.office === office));
}

export function wins(state: BoardState, office?: OfficeId): Order[] {
  return state.orders
    .filter((order) => order.dateFilled && (!office || order.office === office))
    .sort((a, b) => (b.dateFilled ?? "").localeCompare(a.dateFilled ?? ""));
}
