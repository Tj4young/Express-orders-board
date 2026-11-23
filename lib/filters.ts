import { isSavedOrder, savedAt } from "./status";
import type { OfficeId, Order } from "./types";

export type SortKey = "oldest" | "openings";

export function sortOrders(orders: Order[], sort: SortKey): Order[] {
  const copy = [...orders];
  if (sort === "openings") {
    copy.sort(
      (a, b) =>
        b.openings - a.openings ||
        b.openings - b.filled - (a.openings - a.filled) ||
        a.dateOpened.localeCompare(b.dateOpened),
    );
    return copy;
  }
  copy.sort((a, b) => a.dateOpened.localeCompare(b.dateOpened) || a.createdAt.localeCompare(b.createdAt));
  return copy;
}

export function spotsLeft(order: Order): number {
  return Math.max(0, order.openings - order.filled);
}

/** Client and position search. Every word has to appear in either field. */
export function matchesJobQuery(order: Pick<Order, "client" | "position">, query: string): boolean {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return true;
  const haystack = `${order.client} ${order.position}`.toLowerCase();
  return terms.every((term) => haystack.includes(term));
}

/**
 * Filled jobs and competitor pulls for one office, newest first.
 * Open orders are not included. A pull sorts by the day it was marked.
 */
export function savedJobs(orders: Order[], office: OfficeId, query: string): Order[] {
  return orders
    .filter((order) => isSavedOrder(order) && order.office === office && matchesJobQuery(order, query))
    .sort((a, b) => savedAt(b).localeCompare(savedAt(a)) || b.createdAt.localeCompare(a.createdAt));
}

export function matchesFilters(
  order: Order,
  filters: { office?: OfficeId | "all"; recruiterId?: string; shift?: string },
): boolean {
  if (filters.office && filters.office !== "all" && order.office !== filters.office) return false;
  if (filters.recruiterId && filters.recruiterId !== "all" && order.recruiterId !== filters.recruiterId) return false;
  if (filters.shift && filters.shift !== "all" && order.shift !== filters.shift) return false;
  return true;
}
