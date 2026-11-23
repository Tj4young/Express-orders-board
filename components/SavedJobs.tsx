"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { savedJobs } from "@/lib/filters";
import { isLostOrder } from "@/lib/status";
import { formatPrettyDateTime } from "@/lib/time";
import type { OfficeId, Order } from "@/lib/types";

import { ClientLogo } from "./ClientLogo";

export function SavedJobs({
  orders,
  office,
  recruiterName,
  unlocked,
  pendingId,
  onReopen,
  onUndoCompetitor,
  onUnlock,
}: {
  orders: Order[];
  office: OfficeId;
  recruiterName: (id: string) => string;
  unlocked: boolean;
  pendingId: string | null;
  onReopen: (order: Order) => void;
  onUndoCompetitor: (order: Order) => void;
  onUnlock: () => void;
}) {
  const [query, setQuery] = useState("");
  const saved = useMemo(() => savedJobs(orders, office, ""), [orders, office]);
  const shown = useMemo(() => savedJobs(orders, office, query), [orders, office, query]);

  return (
    <section className="saved-jobs" id="saved-jobs" data-testid="saved-jobs" aria-label="Filled and saved jobs">
      <div className="section-head">
        <h2>Filled / Saved jobs</h2>
        <span className="section-links">
          <Link href="/lost">Lost orders</Link>
          <Link href="/wins">Hall of Fame</Link>
        </span>
      </div>
      <p className="quiet">
        When every opening is filled, the job leaves this board and stays here. An order a client pulls for a competitor
        stays here too, marked Competitor filled, and does not count as a win. Reopen puts a fresh copy back with nothing
        filled yet. Undo on a competitor-filled job puts that same order back on the board.
      </p>
      {saved.length > 0 && (
        <label className="field saved-search">
          Search client or position
          <input
            type="search"
            value={query}
            placeholder="Client or position"
            data-testid="saved-search"
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
      )}
      {saved.length === 0 ? (
        <div className="empty">
          <h2>No filled jobs saved yet</h2>
          <p>A finished order lands here, ready to reopen. A competitor pull lands here too, marked with the date.</p>
        </div>
      ) : shown.length === 0 ? (
        <p className="quiet">No saved jobs match that search.</p>
      ) : (
        <ul className="saved-list">
          {shown.map((order) => {
            const lost = isLostOrder(order);
            return (
              <li key={order.id} className={`saved-row${lost ? " is-lost" : ""}`} data-testid={lost ? "saved-lost" : "saved-job"}>
                <ClientLogo client={order.client} logo={order.logo} />
                <div className="saved-copy">
                  <h3>{order.client}</h3>
                  <p className="card-position">{order.position}</p>
                  <p className="saved-meta">
                    {order.payRate} · {order.shift} · {order.openings} {order.openings === 1 ? "opening" : "openings"} ·{" "}
                    {recruiterName(order.recruiterId)}
                  </p>
                  {lost && order.competitorFilledAt ? (
                    <p className="saved-when is-lost" data-testid="saved-lost-label">
                      <span className="pill pill-lost">Competitor filled</span>
                      <span>{formatPrettyDateTime(order.competitorFilledAt)}</span>
                    </p>
                  ) : (
                    <p className="saved-when">{order.dateFilled ? `Filled ${formatPrettyDateTime(order.dateFilled)}` : "Filled"}</p>
                  )}
                  {lost && (
                    <p className="saved-meta">
                      {order.filled} of {order.openings} filled before it was pulled
                    </p>
                  )}
                  {order.notes && <p className="saved-notes">{order.notes}</p>}
                </div>
                {unlocked ? (
                  <div className="saved-actions">
                    {lost && (
                      <button
                        className="btn btn-ghost"
                        type="button"
                        data-testid="undo-competitor"
                        title="Put this order back on the board"
                        disabled={pendingId === order.id}
                        onClick={() => onUndoCompetitor(order)}
                      >
                        Undo
                      </button>
                    )}
                    <button
                      className="btn btn-primary"
                      type="button"
                      data-testid="reopen-button"
                      disabled={pendingId === order.id}
                      onClick={() => onReopen(order)}
                    >
                      Reopen
                    </button>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
      {saved.length > 0 && !unlocked && (
        <button className="btn btn-primary" type="button" onClick={onUnlock}>
          {saved.some(isLostOrder) ? "Unlock to reopen or undo" : "Unlock to reopen"}
        </button>
      )}
    </section>
  );
}
