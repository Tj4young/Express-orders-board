import type { Order } from "./types";

type OrderFlags = Pick<Order, "dateFilled"> & { competitorFilledAt?: string | null };

/** Still on the active board. A win and a competitor pull are both off the board. */
export function isOpenOrder(order: OrderFlags): boolean {
  return !order.dateFilled && !order.competitorFilledAt;
}

/** We filled every opening. A competitor pull is not a win, even if both stamps exist. */
export function isWonOrder(order: OrderFlags): boolean {
  return Boolean(order.dateFilled);
}

/** Client pulled the order. Placements already made stay; this is not a win. */
export function isLostOrder(order: OrderFlags): boolean {
  return Boolean(order.competitorFilledAt) && !order.dateFilled;
}

/** Finished jobs kept for Reopen: our wins and competitor pulls. */
export function isSavedOrder(order: OrderFlags): boolean {
  return Boolean(order.dateFilled || order.competitorFilledAt);
}

/** Timestamp used to sort saved jobs, newest first. Wins use the fill; pulls use the mark. */
export function savedAt(order: Pick<Order, "dateFilled" | "competitorFilledAt" | "createdAt">): string {
  return order.dateFilled || order.competitorFilledAt || order.createdAt;
}
