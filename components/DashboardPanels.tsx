"use client";

import { recentFillDays } from "@/lib/dashboard";
import type { BoardState, OfficeId } from "@/lib/types";

export function KpiRow({
  items,
}: {
  items: { label: string; value: string; hint: string; tone?: "aging" | "lead" }[];
}) {
  return (
    <section className="kpi-row" aria-label="Board snapshot">
      {items.map((item) => (
        <article key={item.label} className={`kpi${item.tone ? ` is-${item.tone}` : ""}`}>
          <span>{item.label}</span>
          <strong>{item.value}</strong>
          <em>{item.hint}</em>
        </article>
      ))}
    </section>
  );
}

export function FillsChart({ state, now, office }: { state: BoardState; now: Date; office?: OfficeId }) {
  const days = recentFillDays(state, now, 14, office);
  const peak = Math.max(1, ...days.map((day) => day.count));
  return (
    <div className="widget" data-testid="fills-chart">
      <header>
        <h2>Fills by day</h2>
        <span>Last 14 days</span>
      </header>
      <svg viewBox="0 0 280 92" role="img" aria-label="Heads placed each day">
        <line x1="8" y1="78" x2="272" y2="78" stroke="rgba(186,230,255,0.25)" strokeWidth="1" />
        {days.map((day, index) => {
          const height = day.count === 0 ? 0 : Math.max(6, (day.count / peak) * 64);
          const x = 8 + index * 19;
          return (
            <g key={day.day}>
              {height > 0 && <rect x={x} y={78 - height} width="12" height={height} rx="3" />}
              <title>
                {day.label}: {day.count}
              </title>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export function OfficeCompare({
  tempe,
  mesa,
}: {
  tempe: { label: string; heads: number };
  mesa: { label: string; heads: number };
}) {
  const max = Math.max(1, tempe.heads, mesa.heads);
  return (
    <div className="widget" data-testid="office-compare">
      <header>
        <h2>Office vs office</h2>
        <span>Heads this month</span>
      </header>
      <div className="compare-bars">
        {[tempe, mesa].map((office) => (
          <div key={office.label}>
            <span>
              {office.label}
              <strong>{office.heads}</strong>
            </span>
            <div>
              <i style={{ width: `${Math.round((office.heads / max) * 100)}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
