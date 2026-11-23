"use client";

import { useMemo, useState } from "react";

import { placementBreakdown } from "@/lib/credit";
import { matchesFilters, sortOrders, spotsLeft, type SortKey } from "@/lib/filters";
import { OFFICE_IDS, OFFICES } from "@/lib/offices";
import {
  formatPlacementWhen,
  formatRate,
  plural,
  recruiterPlacements,
  scoreBoard,
  type OfficeScore,
  type RecruiterPlacement,
  type RecruiterRank,
} from "@/lib/scoring";
import { isOpenOrder } from "@/lib/status";
import { formatClock, formatPhoenixISODate } from "@/lib/time";

import { useBoard } from "./BoardProvider";
import { ClientLogo } from "./ClientLogo";
import { Filters } from "./Filters";
import { IconTrophy } from "./icons";
import { CompactOrder } from "./OrderCard";
import { SiteHeader } from "./SiteHeader";

export function BattleView() {
  const { state, now, loading, loadError, online } = useBoard();
  const [recruiterId, setRecruiterId] = useState("all");
  const [shift, setShift] = useState("all");
  const [sort, setSort] = useState<SortKey>("oldest");
  // Kept across the board poll so a refresh does not close the open name.
  const [openId, setOpenId] = useState<string | null>(null);
  const today = now ? formatPhoenixISODate(now) : null;
  const scores = state && now ? scoreBoard(state, now) : null;
  const openRecruiter = scores?.recruiters.find((person) => person.recruiterId === openId) ?? null;
  const placements = useMemo(() => {
    if (!state || !now || !openId) return [];
    return recruiterPlacements(state, openId, now);
  }, [state, now, openId]);

  const shifts = useMemo(() => {
    if (!state) return [];
    return Array.from(new Set(state.orders.filter((order) => isOpenOrder(order)).map((order) => order.shift).filter(Boolean))).sort();
  }, [state]);

  const nameFor = (id: string) => state?.recruiters.find((person) => person.id === id)?.name ?? "Unassigned";

  return (
    <div className="page page-battle">
      <SiteHeader active="battle" />
      <main id="content" className="battle-main">
        <div className="battle-wrap">
          {!online && state && <p className="banner banner-dark">Reconnecting… last scores are still on screen.</p>}
          {loading && !state ? (
            <div className="empty empty-dark">
              <h2>Loading the battle…</h2>
            </div>
          ) : !state || !scores ? (
            <div className="empty empty-dark">
              <h2>The board can&apos;t load</h2>
              <p>{loadError}</p>
            </div>
          ) : (
            <>
              <section className="battle-scores" aria-label="Tempe versus Mesa">
                <ScorePanel
                  score={scores.tempe}
                  leading={scores.leader === "tempe"}
                  spots={state.orders.filter((order) => order.office === "tempe" && isOpenOrder(order)).reduce((sum, order) => sum + spotsLeft(order), 0)}
                />
                <div className="versus">
                  <span>VS</span>
                  <p data-testid="leader">
                    {scores.leader === "tie" ? "Tied this month" : `${OFFICES[scores.leader].name} leads`}
                  </p>
                </div>
                <ScorePanel
                  score={scores.mesa}
                  leading={scores.leader === "mesa"}
                  spots={state.orders.filter((order) => order.office === "mesa" && isOpenOrder(order)).reduce((sum, order) => sum + spotsLeft(order), 0)}
                />
              </section>
              <p className="score-note">
                Heads are people placed. Fill rate is orders closed ÷ orders worked. Trophy uses this month, Arizona time.
              </p>

              <section className="leaderboard-block" aria-label="Recruiter leaderboard">
                <h2>Recruiter leaderboard · this month</h2>
                <p className="leaderboard-hint">Tap a name to see the placements behind that number.</p>
                <ol className="leaderboard">
                  {scores.recruiters.map((person, index) => {
                    const open = openId === person.recruiterId;
                    return (
                      <li key={person.recruiterId} className={open ? "is-open" : undefined}>
                        <button
                          type="button"
                          className="leaderboard-toggle"
                          aria-expanded={open}
                          aria-controls="leaderboard-placements"
                          data-testid={`leaderboard-${person.recruiterId}`}
                          onClick={() => setOpenId((current) => (current === person.recruiterId ? null : person.recruiterId))}
                        >
                          <span className="rank">{index + 1}</span>
                          <span className="who">
                            <strong>{person.name}</strong>
                            <em>{OFFICES[person.office].short}</em>
                          </span>
                          <span className="heads">
                            {person.monthHeads}
                            <small> this month</small>
                          </span>
                          <span className="leaderboard-chevron" aria-hidden="true" />
                        </button>
                      </li>
                    );
                  })}
                </ol>
                {openRecruiter && state && (
                  <PlacementList recruiter={openRecruiter} rows={placements} />
                )}
              </section>

              <Filters
                tone="dark"
                office="all"
                recruiterId={recruiterId}
                shift={shift}
                sort={sort}
                recruiters={state.recruiters}
                shifts={shifts}
                onOffice={() => undefined}
                onRecruiter={setRecruiterId}
                onShift={setShift}
                onSort={setSort}
              />

              <section className="battle-columns">
                {OFFICE_IDS.map((office) => {
                  const orders = sortOrders(
                    state.orders.filter(
                      (order) => isOpenOrder(order) && order.office === office && matchesFilters(order, { recruiterId, shift }),
                    ),
                    sort,
                  );
                  return (
                    <div key={office} className={`battle-column battle-${office}`}>
                      <header>
                        <h2>{OFFICES[office].name}</h2>
                        <span>{orders.length} open</span>
                      </header>
                      <div className="battle-scroll">
                        {orders.length === 0 ? (
                          <p className="quiet">No open orders. The desk is clear.</p>
                        ) : (
                          orders.map((order) => (
                            <CompactOrder
                              key={order.id}
                              order={order}
                              recruiterName={nameFor(order.recruiterId)}
                              credit={placementBreakdown(state, order.id)}
                              today={today}
                            />
                          ))
                        )}
                      </div>
                    </div>
                  );
                })}
              </section>

              <Ticker wins={scores.recentWins} />
            </>
          )}
        </div>
      </main>
    </div>
  );
}

function PlacementList({ recruiter, rows }: { recruiter: RecruiterRank; rows: RecruiterPlacement[] }) {
  return (
    <div
      id="leaderboard-placements"
      className="leaderboard-detail"
      role="region"
      aria-label={`${recruiter.name}'s placements this month`}
      data-testid="leaderboard-placements"
    >
      <header>
        <h3>{recruiter.name}</h3>
        <p>{plural(recruiter.monthHeads, "placement")} this month</p>
      </header>
      {rows.length === 0 ? (
        <p className="leaderboard-empty">No placements this month.</p>
      ) : (
        <ul className="placement-list">
          {rows.map((row) => (
            <li key={row.orderId} className="placement-row" data-testid="placement-row">
              <ClientLogo client={row.client} logo={row.logo} size={44} />
              <div className="placement-copy">
                <strong>{row.client}</strong>
                {row.position ? <span>{row.position}</span> : null}
              </div>
              <span className="placement-office">{row.officeName}</span>
              <span className="placement-count">{row.count} placed</span>
              <time className="placement-date" dateTime={row.latestDay}>
                {formatPlacementWhen(row)}
              </time>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ScorePanel({ score, leading, spots }: { score: OfficeScore; leading: boolean; spots: number }) {
  return (
    <article className={`score-panel${leading ? " is-leading" : ""}`} data-testid={`score-${score.office}`}>
      <header>
        <h2>{score.name}</h2>
        {leading && (
          <span className="trophy" data-testid="trophy">
            <IconTrophy />
            Leading
          </span>
        )}
      </header>
      <p className="score-number" data-testid={`heads-${score.office}`}>
        {score.monthHeads}
      </p>
      <p className="score-caption">heads this month</p>
      <p className="score-sub">
        {plural(score.monthOrders, "order")} filled · {formatRate(score.monthFillRate)} fill rate
      </p>
      <div className="score-week">
        <span>This week</span>
        <strong>{score.weekHeads} heads</strong>
        <strong>{plural(score.weekOrders, "order")}</strong>
        <strong>{formatRate(score.weekFillRate)} fill rate</strong>
      </div>
      <p className="score-open">{spots} spots still open</p>
    </article>
  );
}

function Ticker({
  wins,
}: {
  wins: { orderId: string; officeName: string; position: string; client: string; recruiterName: string; at: string }[];
}) {
  if (wins.length === 0) {
    return (
      <div className="ticker" data-testid="ticker">
        <p>Filled orders scroll here as soon as a desk closes one.</p>
      </div>
    );
  }
  const items = [...wins, ...wins];
  return (
    <div className="ticker" data-testid="ticker" aria-label="Recent wins">
      <div className="ticker-track">
        {items.map((win, index) => (
          <span key={`${win.orderId}-${index}`}>
            🎉 {win.officeName} filled {win.position} at {win.client} · {win.recruiterName} · {formatClock(win.at)}
          </span>
        ))}
      </div>
    </div>
  );
}
