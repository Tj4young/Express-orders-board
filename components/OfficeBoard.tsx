"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { placementBreakdown } from "@/lib/credit";
import { matchesFilters, sortOrders, spotsLeft, type SortKey } from "@/lib/filters";
import { OFFICES } from "@/lib/offices";
import { formatRate, plural, scoreBoard } from "@/lib/scoring";
import { isLostOrder, isOpenOrder } from "@/lib/status";
import { formatPhoenixISODate } from "@/lib/time";
import type { OfficeId, Order } from "@/lib/types";

import { useBoard } from "./BoardProvider";
import { Filters } from "./Filters";
import { OpenOrdersDrawer } from "./OpenOrdersDrawer";
import { OrderCard } from "./OrderCard";
import { SavedJobs } from "./SavedJobs";
import { SiteHeader } from "./SiteHeader";

export function OfficeBoard({ office }: { office: OfficeId }) {
  const board = useBoard();
  const {
    state,
    now,
    unlocked,
    openOrder,
    openRecruiters,
    openPlace,
    openUnlock,
    undoFill,
    markCompetitorFilled,
    undoCompetitorFilled,
    deleteOrder,
    addExample,
    reopenOrder,
    pendingId,
    loadError,
    loading,
    online,
  } = board;
  const router = useRouter();
  const [recruiterId, setRecruiterId] = useState("all");
  const [shift, setShift] = useState("all");
  const [sort, setSort] = useState<SortKey>("oldest");
  const [ghosts, setGhosts] = useState<Order[]>([]);
  const [focus, setFocus] = useState<{ id: string; tick: number } | null>(null);
  const prevIds = useRef<string[] | null>(null);

  const today = now ? formatPhoenixISODate(now) : null;
  const info = OFFICES[office];
  const rival = office === "tempe" ? "mesa" : "tempe";

  const active = useMemo(() => {
    if (!state) return [];
    return state.orders.filter((order) => isOpenOrder(order) && order.office === office);
  }, [state, office]);

  const openEverywhere = useMemo(() => {
    if (!state) return [];
    return state.orders.filter((order) => isOpenOrder(order));
  }, [state]);

  const filtered = useMemo(() => {
    const matching = active.filter((order) => matchesFilters(order, { recruiterId, shift }));
    const focused = focus ? active.find((order) => order.id === focus.id && !matching.some((item) => item.id === order.id)) : undefined;
    return sortOrders(focused ? [...matching, focused] : matching, sort);
  }, [active, recruiterId, shift, sort, focus]);

  const filteredKey = filtered.map((order) => order.id).join("|");
  const ordersRef = useRef<Order[]>([]);
  ordersRef.current = state?.orders ?? [];
  const filteredRef = useRef<Order[]>([]);
  filteredRef.current = filtered;

  useEffect(() => {
    const ids = filteredRef.current.map((order) => order.id);
    if (prevIds.current) {
      const removed = prevIds.current.filter((id) => !ids.includes(id));
      const completed = removed
        .map((id) => ordersRef.current.find((order) => order.id === id))
        .filter((order): order is Order => Boolean(order && (order.dateFilled || order.competitorFilledAt)));
      if (completed.length > 0) {
        const fresh = completed;
        setGhosts((current) => [...current.filter((order) => !fresh.some((item) => item.id === order.id)), ...fresh]);
        const gone = new Set(fresh.map((order) => order.id));
        window.setTimeout(() => {
          setGhosts((current) => current.filter((order) => !gone.has(order.id)));
        }, 800);
      }
    }
    prevIds.current = ids;
  }, [filteredKey]);

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("focus");
    if (!id) return;
    setFocus({ id, tick: Date.now() });
    const url = new URL(window.location.href);
    url.searchParams.delete("focus");
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
  }, [office]);

  useEffect(() => {
    if (!focus) return;
    const node = document.getElementById(`order-${focus.id}`);
    if (!node) return;
    node.scrollIntoView({ behavior: "smooth", block: "center" });
    const timer = window.setTimeout(() => {
      setFocus((current) => (current?.tick === focus.tick ? null : current));
    }, 4500);
    return () => window.clearTimeout(timer);
  }, [focus, filteredKey]);

  function jumpTo(order: Order) {
    if (order.office !== office) {
      router.push(`/${order.office}?focus=${encodeURIComponent(order.id)}`);
      return;
    }
    if (!matchesFilters(order, { recruiterId, shift })) {
      setRecruiterId("all");
      setShift("all");
    }
    setFocus({ id: order.id, tick: Date.now() });
  }

  async function reopen(order: Order) {
    const id = await reopenOrder(order.id);
    if (!id) return;
    if (!matchesFilters(order, { recruiterId, shift })) {
      setRecruiterId("all");
      setShift("all");
    }
    setFocus({ id, tick: Date.now() });
  }

  const shifts = useMemo(() => {
    return Array.from(new Set(active.map((order) => order.shift).filter(Boolean))).sort();
  }, [active]);

  const scores = state && now ? scoreBoard(state, now) : null;
  const mine = scores ? scores[office] : null;
  const other = scores ? scores[rival] : null;
  const spots = active.reduce((sum, order) => sum + spotsLeft(order), 0);
  const lostCount = state ? state.orders.filter((order) => order.office === office && isLostOrder(order)).length : 0;
  const agingCount = today ? active.filter((order) => today && order.dateOpened <= addDaysSafe(today, -14)).length : 0;

  const nameFor = (id: string) => state?.recruiters.find((person) => person.id === id)?.name ?? "Unassigned";
  const visible = [
    ...filtered,
    ...ghosts.filter((order) => !filtered.some((item) => item.id === order.id)),
  ];
  const hasExample = state?.orders.some((order) => order.example) ?? false;

  return (
    <div className="page">
      {state && <OpenOrdersDrawer orders={openEverywhere} currentOffice={office} onSelect={jumpTo} />}
      <SiteHeader active={office} />
      <main id="content" className="wrap board-main">
        {!online && state && <p className="banner">Reconnecting… the last orders are still on screen.</p>}
        <div className="page-intro">
          <div>
            <p className="eyebrow">Express Employment Professionals</p>
            <h1>{info.name}</h1>
            <p className="lede">
              Open orders for the {info.short} desk. Both offices see the same board within a few seconds. The Open orders tab jumps to any card.
            </p>
            {mine && other && (
              <p className="rival-line">
                This month: <strong>{mine.monthHeads}</strong> heads · {plural(mine.monthOrders, "order")} filled · {formatRate(mine.monthFillRate)} fill rate.
                {scores?.leader === office
                  ? " You're leading."
                  : scores?.leader === "tie"
                    ? " You're tied with " + OFFICES[rival].name + "."
                    : ` ${other.name} is ahead with ${other.monthHeads}.`}
              </p>
            )}
          </div>
          <div className="intro-actions">
            {unlocked ? (
              <>
                <button className="btn btn-ghost" type="button" onClick={openRecruiters}>
                  Recruiters
                </button>
                {!hasExample && (
                  <button className="btn btn-ghost" type="button" onClick={() => void addExample()}>
                    Add example order
                  </button>
                )}
                <button className="btn btn-primary" type="button" data-testid="add-order" onClick={() => openOrder(null, office)} disabled={!state}>
                  + Add order
                </button>
              </>
            ) : (
              <button className="btn btn-primary" type="button" onClick={openUnlock}>
                Unlock to edit
              </button>
            )}
          </div>
        </div>

        <section className="stats" aria-label="Office snapshot">
          <article className="stat">
            <strong>{active.length}</strong>
            <span>Open orders</span>
          </article>
          <article className="stat">
            <strong>{spots}</strong>
            <span>Spots left</span>
          </article>
          <article className="stat">
            <strong>{mine ? mine.weekHeads : "—"}</strong>
            <span>Heads this week</span>
          </article>
          <article className={`stat${agingCount > 0 ? " is-aging" : ""}`}>
            <strong>{today ? agingCount : "—"}</strong>
            <span>Aging 14+ days</span>
          </article>
          <Link
            className={`stat stat-link${lostCount > 0 ? " has-lost" : ""}`}
            href="/lost"
            data-testid="competitor-count"
          >
            <strong>{lostCount}</strong>
            <span>Competitor filled</span>
          </Link>
        </section>

        {state && (
          <Filters
            office={office}
            recruiterId={recruiterId}
            shift={shift}
            sort={sort}
            recruiters={state.recruiters.filter((person) => person.office === office || active.some((order) => order.recruiterId === person.id))}
            shifts={shifts}
            onOffice={() => undefined}
            onRecruiter={setRecruiterId}
            onShift={setShift}
            onSort={setSort}
          />
        )}

        {loading && !state ? (
          <div className="empty">
            <h2>Loading the board…</h2>
          </div>
        ) : !state ? (
          <div className="empty">
            <h2>The board can&apos;t load</h2>
            <p>{loadError}</p>
          </div>
        ) : visible.length === 0 ? (
          <div className="empty">
            <p className="eyebrow">{info.name}</p>
            <h2>{active.length === 0 ? "No open orders" : "Nothing matches those filters"}</h2>
            <p>
              {active.length === 0
                ? "When a client calls, add the order. It shows up here, on the other office's laptop, and on the Battle TV."
                : "Clear a recruiter or shift filter to see the rest of the desk."}
            </p>
            {active.length === 0 &&
              (unlocked ? (
                <button className="btn btn-primary" type="button" onClick={() => openOrder(null, office)}>
                  Add an order
                </button>
              ) : (
                <button className="btn btn-primary" type="button" onClick={openUnlock}>
                  Unlock to add orders
                </button>
              ))}
          </div>
        ) : (
          <div className="order-grid">
            {visible.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                recruiterName={nameFor(order.recruiterId)}
                credit={state ? placementBreakdown(state, order.id) : ""}
                today={today}
                readOnly={!unlocked}
                exiting={ghosts.some((ghost) => ghost.id === order.id)}
                pending={pendingId === order.id}
                targeted={focus?.id === order.id}
                onFill={() => openPlace(order)}
                onUndo={() => void undoFill(order.id)}
                onEdit={() => openOrder(order, order.office)}
                onDelete={() => void deleteOrder(order.id)}
                onCompetitor={() => void markCompetitorFilled(order.id)}
              />
            ))}
          </div>
        )}

        {state && (
          <SavedJobs
            orders={state.orders}
            office={office}
            recruiterName={nameFor}
            unlocked={unlocked}
            pendingId={pendingId}
            onReopen={(order) => void reopen(order)}
            onUndoCompetitor={(order) => void undoCompetitorFilled(order.id)}
            onUnlock={openUnlock}
          />
        )}
        <footer className="site-footer">Express Employment Professionals · Tempe & Mesa, Arizona · Scores use Arizona time, Monday through Sunday.</footer>
      </main>
    </div>
  );
}

function addDaysSafe(iso: string, days: number) {
  const [year, month, day] = iso.split("-").map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day));
  utc.setUTCDate(utc.getUTCDate() + days);
  return utc.toISOString().slice(0, 10);
}
