"use client";

import { useMemo, useState } from "react";

import { placementBreakdown } from "@/lib/credit";
import { matchesFilters, sortOrders, type SortKey } from "@/lib/filters";
import type { OfficeId } from "@/lib/types";

import { useBoard } from "./BoardProvider";
import { Filters } from "./Filters";
import { SiteHeader } from "./SiteHeader";
import { WinCard } from "./WinCard";

export function WinsView() {
  const { state, now, unlocked, openOrder, openUnlock, undoFill, deleteOrder, pendingId, celebration, loading, loadError, online } = useBoard();
  const [office, setOffice] = useState<OfficeId | "all">("all");
  const [recruiterId, setRecruiterId] = useState("all");
  const [shift, setShift] = useState("all");
  const [sort, setSort] = useState<SortKey>("oldest");

  const wins = useMemo(() => {
    if (!state) return [];
    const filled = state.orders.filter((order) => order.dateFilled && matchesFilters(order, { office, recruiterId, shift }));
    if (sort === "openings") return sortOrders(filled, "openings");
    return [...filled].sort((a, b) => (b.dateFilled ?? "").localeCompare(a.dateFilled ?? ""));
  }, [state, office, recruiterId, shift, sort]);

  const shifts = useMemo(() => {
    if (!state) return [];
    return Array.from(new Set(state.orders.filter((order) => order.dateFilled).map((order) => order.shift).filter(Boolean))).sort();
  }, [state]);

  const nameFor = (id: string) => state?.recruiters.find((person) => person.id === id)?.name ?? "Unassigned";

  return (
    <div className="page">
      <SiteHeader active="wins" />
      <main id="content" className="wrap board-main">
        {!online && state && <p className="banner">Reconnecting… the last wins are still on screen.</p>}
        <div className="page-intro">
          <div>
            <p className="eyebrow">Hall of Fame</p>
            <h1>Wins</h1>
            <p className="lede">Orders leave the active board the moment filled catches openings. Undo a fill if it was a mistake.</p>
          </div>
          {!unlocked && (
            <div className="intro-actions">
              <button className="btn btn-primary" type="button" onClick={openUnlock}>
                Unlock to edit
              </button>
            </div>
          )}
        </div>
        {loading && !state ? (
          <div className="empty">
            <h2>Loading wins…</h2>
          </div>
        ) : !state ? (
          <div className="empty">
            <h2>The board can&apos;t load</h2>
            <p>{loadError}</p>
          </div>
        ) : (
          <>
            <Filters
              showOffice
              office={office}
              recruiterId={recruiterId}
              shift={shift}
              sort={sort}
              recruiters={state.recruiters}
              shifts={shifts}
              onOffice={setOffice}
              onRecruiter={setRecruiterId}
              onShift={setShift}
              onSort={setSort}
              oldestLabel="Newest filled"
            />
            {wins.length === 0 ? (
              <div className="empty">
                <h2>No wins yet</h2>
                <p>When an order is completely filled, it celebrates and lands here.</p>
              </div>
            ) : (
              <div className="order-grid">
                {wins.map((order) => (
                  <WinCard
                    key={order.id}
                    order={order}
                    recruiterName={nameFor(order.recruiterId)}
                    credit={placementBreakdown(state, order.id)}
                    fresh={celebration?.orderId === order.id || Boolean(now && order.dateFilled && now.getTime() - new Date(order.dateFilled).getTime() < 20_000)}
                    unlocked={unlocked}
                    pending={pendingId === order.id}
                    onUndo={() => void undoFill(order.id)}
                    onEdit={() => openOrder(order, order.office)}
                    onDelete={() => void deleteOrder(order.id)}
                  />
                ))}
              </div>
            )}
          </>
        )}
        <footer className="site-footer">Express Employment Professionals · Tempe & Mesa, Arizona</footer>
      </main>
    </div>
  );
}
