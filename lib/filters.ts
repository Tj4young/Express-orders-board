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

export function matchesFilters(
  order: Order,
  filters: { office?: OfficeId | "all"; recruiterId?: string; shift?: string },
): boolean {
  if (filters.office && filters.office !== "all" && order.office !== filters.office) return false;
  if (filters.recruiterId && filters.recruiterId !== "all" && order.recruiterId !== filters.recruiterId) return false;
  if (filters.shift && filters.shift !== "all" && order.shift !== filters.shift) return false;
  return true;
}
