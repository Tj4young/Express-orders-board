"use client";

import { useMemo, useState } from "react";

import { matchesFilters, sortOrders, spotsLeft, type SortKey } from "@/lib/filters";
import { OFFICE_IDS, OFFICES } from "@/lib/offices";
import { formatRate, plural, scoreBoard, type OfficeScore } from "@/lib/scoring";
import { formatClock, formatPhoenixISODate } from "@/lib/time";

import { useBoard } from "./BoardProvider";
import { Filters } from "./Filters";
import { IconTrophy } from "./icons";
import { CompactOrder } from "./OrderCard";
import { SiteHeader } from "./SiteHeader";

export function BattleView() {
  const { state, now, loading, loadError, online } = useBoard();
  const [recruiterId, setRecruiterId] = useState("all");
  const [shift, setShift] = useState("all");
  const [sort, setSort] = useState<SortKey>("oldest");
  const today = now ? formatPhoenixISODate(now) : null;
  const scores = state && now ? scoreBoard(state, now) : null;

  const shifts = useMemo(() => {
    if (!state) return [];
    return Array.from(new Set(state.orders.filter((order) => !order.dateFilled).map((order) => order.shift).filter(Boolean))).sort();
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
                  spots={state.orders.filter((order) => order.office === "tempe" && !order.dateFilled).reduce((sum, order) => sum + spotsLeft(order), 0)}
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
                  spots={state.orders.filter((order) => order.office === "mesa" && !order.dateFilled).reduce((sum, order) => sum + spotsLeft(order), 0)}
                />
              </section>
              <p className="score-note">
                Heads are people placed. Fill rate is orders closed ÷ orders worked. Trophy uses this month, Arizona time.
              </p>

              <section className="leaderboard-block" aria-label="Recruiter leaderboard">
                <h2>Recruiter leaderboard · this month</h2>
                <ol className="leaderboard">
                  {scores.recruiters.map((person, index) => (
                    <li key={person.recruiterId}>
                      <span className="rank">{index + 1}</span>
                      <span className="who">
                        <strong>{person.name}</strong>
                        <em>{OFFICES[person.office].short}</em>
                      </span>
                      <span className="heads">
                        {person.monthHeads}
                        <small> this month</small>
                      </span>
                    </li>
                  ))}
                </ol>
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
                      (order) => !order.dateFilled && order.office === office && matchesFilters(order, { recruiterId, shift }),
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
                            <CompactOrder key={order.id} order={order} recruiterName={nameFor(order.recruiterId)} today={today} />
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
