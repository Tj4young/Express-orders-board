"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { savedJobs } from "@/lib/filters";
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
  onUnlock,
}: {
  orders: Order[];
  office: OfficeId;
  recruiterName: (id: string) => string;
  unlocked: boolean;
  pendingId: string | null;
  onReopen: (order: Order) => void;
  onUnlock: () => void;
}) {
  const [query, setQuery] = useState("");
  const saved = useMemo(() => savedJobs(orders, office, ""), [orders, office]);
  const shown = useMemo(() => savedJobs(orders, office, query), [orders, office, query]);

  return (
    <section className="saved-jobs" id="saved-jobs" data-testid="saved-jobs" aria-label="Filled and saved jobs">
      <div className="section-head">
        <h2>Filled / Saved jobs</h2>
        <Link href="/wins">Hall of Fame</Link>
      </div>
      <p className="quiet">
        When every opening is filled, the job leaves this board and stays here. Reopen puts a fresh copy back with the same
        details and nothing filled yet. The original win keeps its credit.
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
          <p>A finished order lands here, ready to reopen the next time that client needs the same position.</p>
        </div>
      ) : shown.length === 0 ? (
        <p className="quiet">No saved jobs match that search.</p>
      ) : (
        <ul className="saved-list">
          {shown.map((order) => (
            <li key={order.id} className="saved-row" data-testid="saved-job">
              <ClientLogo client={order.client} logo={order.logo} />
              <div className="saved-copy">
                <h3>{order.client}</h3>
                <p className="card-position">{order.position}</p>
                <p className="saved-meta">
                  {order.payRate} · {order.shift} · {order.openings} {order.openings === 1 ? "opening" : "openings"} ·{" "}
                  {recruiterName(order.recruiterId)}
                </p>
                <p className="saved-when">{order.dateFilled ? `Filled ${formatPrettyDateTime(order.dateFilled)}` : "Filled"}</p>
                {order.notes && <p className="saved-notes">{order.notes}</p>}
              </div>
              {unlocked ? (
                <button
                  className="btn btn-primary"
                  type="button"
                  data-testid="reopen-button"
                  disabled={pendingId === order.id}
                  onClick={() => onReopen(order)}
                >
                  Reopen
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      {saved.length > 0 && !unlocked && (
        <button className="btn btn-primary" type="button" onClick={onUnlock}>
          Unlock to reopen
        </button>
      )}
    </section>
  );
}
