"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import { placementBreakdown } from "@/lib/credit";
import { matchesFilters, sortOrders, spotsLeft, type SortKey } from "@/lib/filters";
import { OFFICES } from "@/lib/offices";
import { formatRate, plural, scoreBoard } from "@/lib/scoring";
import { formatPhoenixISODate, isAging } from "@/lib/time";
import type { OfficeId, Order } from "@/lib/types";

import { ArizonaMap } from "./ArizonaMap";
import { useBoard } from "./BoardProvider";
import { FillsChart, KpiRow, OfficeCompare } from "./DashboardPanels";
import { Filters } from "./Filters";
import { OrderCard } from "./OrderCard";
import { SiteHeader } from "./SiteHeader";
import { WinCard } from "./WinCard";

export function OfficeBoard({ office }: { office: OfficeId }) {
  const board = useBoard();
  const { state, now, unlocked, openOrder, openRecruiters, openPlace, openUnlock, undoFill, deleteOrder, addExample, pendingId, loadError, loading, online, celebration } = board;
  const [recruiterId, setRecruiterId] = useState("all");
  const [shift, setShift] = useState("all");
  const [sort, setSort] = useState<SortKey>("oldest");
  const [ghosts, setGhosts] = useState<Order[]>([]);
  const prevIds = useRef<string[] | null>(null);

  const today = now ? formatPhoenixISODate(now) : null;
  const info = OFFICES[office];
  const rival = office === "tempe" ? "mesa" : "tempe";

  const active = useMemo(() => {
    if (!state) return [];
    return state.orders.filter((order) => !order.dateFilled && order.office === office);
  }, [state, office]);

  const filtered = useMemo(() => {
    return sortOrders(
      active.filter((order) => matchesFilters(order, { recruiterId, shift })),
      sort,
    );
  }, [active, recruiterId, shift, sort]);

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
        .filter((order): order is Order => Boolean(order?.dateFilled));
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

  const shifts = useMemo(() => {
    return Array.from(new Set(active.map((order) => order.shift).filter(Boolean))).sort();
  }, [active]);

  const scores = state && now ? scoreBoard(state, now) : null;
  const mine = scores ? scores[office] : null;
  const other = scores ? scores[rival] : null;
  const spots = active.reduce((sum, order) => sum + spotsLeft(order), 0);
  const agingCount = today ? active.filter((order) => isAging(order.dateOpened, today, order.dateFilled)).length : 0;
  const wins = useMemo(() => {
    if (!state) return [];
    return state.orders
      .filter((order) => order.dateFilled && order.office === office)
      .sort((a, b) => (b.dateFilled ?? "").localeCompare(a.dateFilled ?? ""));
  }, [state, office]);

  const nameFor = (id: string) => state?.recruiters.find((person) => person.id === id)?.name ?? "Unassigned";
  const visible = [
    ...filtered,
    ...ghosts.filter((order) => !filtered.some((item) => item.id === order.id)),
  ];
  const hasExample = state?.orders.some((order) => order.example) ?? false;

  return (
    <div className="page">
      <SiteHeader active={office} />
      <main id="content" className="wrap board-main">
        {!online && state && <p className="banner">Reconnecting… the last orders are still on screen.</p>}
        <div className="page-intro">
          <div>
            <p className="eyebrow">Express Employment Professionals</p>
            <h1>{info.name}</h1>
            <p className="lede">Open orders for the {info.short} desk. Both offices see the same board within a few seconds.</p>
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

        <KpiRow
          items={[
            { label: "Open orders", value: String(active.length), hint: info.short },
            { label: "Headcount needed", value: String(spots), hint: "Spots still open" },
            { label: "Filled this month", value: mine ? String(mine.monthOrders) : "—", hint: mine ? `${mine.monthHeads} heads` : "Arizona time" },
            { label: "Aging orders", value: today ? String(agingCount) : "—", hint: "Open 14+ days", tone: agingCount > 0 ? "aging" : undefined },
            {
              label: "Office leader",
              value: !scores ? "—" : scores.leader === "tie" ? "Tied" : OFFICES[scores.leader].short,
              hint: "This month",
              tone: "lead",
            },
          ]}
        />
        {state && now && scores && (
          <section className="office-widgets">
            <div className="widget widget-map">
              <header>
                <h2>Arizona</h2>
                <span>{info.short} on the map</span>
              </header>
              <ArizonaMap
                compact
                tempe={{
                  open: state.orders.filter((order) => order.office === "tempe" && !order.dateFilled).length,
                  month: scores.tempe.monthHeads,
                }}
                mesa={{
                  open: state.orders.filter((order) => order.office === "mesa" && !order.dateFilled).length,
                  month: scores.mesa.monthHeads,
                }}
                pulse={celebration?.office ?? null}
              />
            </div>
            <FillsChart state={state} now={now} office={office} />
            <OfficeCompare
              tempe={{ label: "Tempe", heads: scores.tempe.monthHeads }}
              mesa={{ label: "Mesa", heads: scores.mesa.monthHeads }}
            />
          </section>
        )}

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
                onFill={() => openPlace(order)}
                onUndo={() => void undoFill(order.id)}
                onEdit={() => openOrder(order, order.office)}
                onDelete={() => void deleteOrder(order.id)}
              />
            ))}
          </div>
        )}

        <section className="wins-preview" id="recent-wins">
          <div className="section-head">
            <h2>Recent wins</h2>
            <Link href="/wins">Hall of Fame</Link>
          </div>
          {wins.length === 0 ? (
            <p className="quiet">Filled orders slide off this board and land here.</p>
          ) : (
            <div className="win-row">
              {wins.slice(0, 3).map((order) => (
                <WinCard
                  key={order.id}
                  order={order}
                  recruiterName={nameFor(order.recruiterId)}
                  credit={state ? placementBreakdown(state, order.id) : ""}
                  fresh={celebration?.orderId === order.id || isFresh(order, now)}
                  unlocked={unlocked}
                  pending={pendingId === order.id}
                  onUndo={() => void undoFill(order.id)}
                  onEdit={() => openOrder(order, order.office)}
                  onDelete={() => void deleteOrder(order.id)}
                />
              ))}
            </div>
          )}
        </section>
        <footer className="site-footer">Express Employment Professionals · Tempe & Mesa, Arizona · Scores use Arizona time, Monday through Sunday.</footer>
      </main>
    </div>
  );
}

function isFresh(order: Order, now: Date | null) {
  if (!now || !order.dateFilled) return false;
  return now.getTime() - new Date(order.dateFilled).getTime() < 20_000;
}
