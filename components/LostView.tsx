"use client";

import { useMemo, useState } from "react";

import {
  filterLostRows,
  formatMonthLabel,
  lostClientTotals,
  lostMonths,
  lostOfficeTotals,
  lostOrderRows,
  lostOrdersCsv,
} from "@/lib/lost";
import { plural } from "@/lib/scoring";
import { formatPrettyDateTime } from "@/lib/time";

import { useBoard } from "./BoardProvider";
import { SiteHeader } from "./SiteHeader";

export function LostView() {
  const { state, now, loading, loadError, online } = useBoard();
  const [month, setMonth] = useState("all");
  const rows = useMemo(() => (state ? lostOrderRows(state) : []), [state]);
  const months = useMemo(() => lostMonths(rows, now, month), [rows, now, month]);
  const shown = useMemo(() => filterLostRows(rows, month), [rows, month]);
  const offices = useMemo(() => lostOfficeTotals(shown), [shown]);
  const clients = useMemo(() => lostClientTotals(shown), [shown]);

  function exportCsv() {
    const csv = lostOrdersCsv(shown);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = month === "all" ? "lost-orders.csv" : `lost-orders-${month}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="page">
      <SiteHeader active="lost" />
      <main id="content" className="wrap board-main" data-testid="lost-report">
        {!online && state && <p className="banner">Reconnecting… the last lost orders are still on screen.</p>}
        <div className="page-intro">
          <div>
            <p className="eyebrow">Pulled by the client</p>
            <h1>Lost orders</h1>
            <p className="lede">
              Orders a client pulled because a competitor filled them. They are not wins. Placements already made still count.
              Openings that were still empty do not. Undo on the office board removes a mistaken order from this report.
            </p>
          </div>
        </div>

        {loading && !state ? (
          <div className="empty">
            <h2>Loading lost orders…</h2>
          </div>
        ) : !state ? (
          <div className="empty">
            <h2>The board can&apos;t load</h2>
            <p>{loadError}</p>
          </div>
        ) : (
          <>
            <div className="lost-toolbar">
              <label className="field">
                Month
                <select
                  value={month}
                  data-testid="lost-month"
                  onChange={(event) => setMonth(event.target.value)}
                >
                  <option value="all">All months</option>
                  {months.map((key) => (
                    <option key={key} value={key}>
                      {formatMonthLabel(key)}
                    </option>
                  ))}
                </select>
              </label>
              <button className="btn btn-primary" type="button" data-testid="lost-export" onClick={exportCsv}>
                Export CSV
              </button>
            </div>

            <section className="lost-totals" aria-label="Lost order totals">
              <article className="lost-panel">
                <h2>By office</h2>
                <ul className="lost-office-totals">
                  {offices.map((office) => (
                    <li key={office.office} data-testid={`lost-office-${office.office}`}>
                      <span>{office.name}</span>
                      <strong>{office.count}</strong>
                    </li>
                  ))}
                </ul>
              </article>
              <article className="lost-panel">
                <h2>By client</h2>
                {clients.length === 0 ? (
                  <p className="quiet">No clients in this view.</p>
                ) : (
                  <ol className="lost-client-totals">
                    {clients.map((client, index) => (
                      <li key={client.client} data-testid="lost-client">
                        <span>
                          <em>{index + 1}</em>
                          {client.client}
                        </span>
                        <strong>{client.count}</strong>
                      </li>
                    ))}
                  </ol>
                )}
                <p className="quiet lost-client-note">Clients who pull the most are at the top.</p>
              </article>
            </section>

            {shown.length === 0 ? (
              <div className="empty">
                <h2>{rows.length === 0 ? "No competitor-filled orders yet" : "Nothing in that month"}</h2>
                <p>
                  {rows.length === 0
                    ? "When a client pulls a job, mark Competitor filled on the order card. It lands here with the date."
                    : "Choose another month, or All months, to see the other pulls."}
                </p>
              </div>
            ) : (
              <div className="lost-table-wrap">
                <table className="lost-table">
                  <caption className="sr-only">Competitor-filled orders</caption>
                  <thead>
                    <tr>
                      <th scope="col">Date marked</th>
                      <th scope="col">Office</th>
                      <th scope="col">Client</th>
                      <th scope="col">Position</th>
                      <th scope="col">Filled before pull</th>
                      <th scope="col">Recruiter</th>
                      <th scope="col">Days open</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shown.map((row) => (
                      <tr key={row.orderId} data-testid="lost-row" data-office={row.office}>
                        <td>{formatPrettyDateTime(row.markedAt)}</td>
                        <td>{row.officeName}</td>
                        <td>{row.client}</td>
                        <td>{row.position}</td>
                        <td>
                          {row.filled} of {row.openings}
                        </td>
                        <td>{row.recruiterName}</td>
                        <td>{plural(row.daysOpen, "day")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
        <footer className="site-footer">Express Employment Professionals · Tempe & Mesa, Arizona · Dates use Arizona time.</footer>
      </main>
    </div>
  );
}
