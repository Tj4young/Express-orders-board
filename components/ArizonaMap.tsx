"use client";

import { ARIZONA_CITIES, ARIZONA_PATH, ARIZONA_VIEW, METRO_CITIES, pinRadius, type MapCity } from "@/lib/arizona";
import type { OfficeId } from "@/lib/types";

type CityStat = { open: number; month: number };

export function ArizonaMap({
  tempe,
  mesa,
  pulse,
  compact = false,
}: {
  tempe: CityStat;
  mesa: CityStat;
  pulse: OfficeId | null;
  compact?: boolean;
}) {
  const stats: Record<MapCity, CityStat | null> = {
    tempe,
    mesa,
    chandler: null,
  };
  return (
    <div className={`az-map${compact ? " is-compact" : ""}`} data-testid="az-map">
      <svg viewBox={`0 0 ${ARIZONA_VIEW.width} ${ARIZONA_VIEW.height}`} role="img" aria-label="Arizona, with Tempe and Mesa">
        <defs>
          <linearGradient id="az-fill" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#123a66" />
            <stop offset="45%" stopColor="#0c6eab" />
            <stop offset="100%" stopColor="#5b4fd6" />
          </linearGradient>
          <filter id="az-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="6" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <pattern id="az-grid" width="28" height="28" patternUnits="userSpaceOnUse">
            <path d="M28 0H0V28" fill="none" stroke="rgba(186,230,255,0.16)" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#az-grid)" />
        <path d={ARIZONA_PATH} fill="url(#az-fill)" stroke="#9be7ff" strokeWidth="2.4" filter="url(#az-glow)" />
        <path d={ARIZONA_PATH} fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="1" />
        {(Object.keys(ARIZONA_CITIES) as MapCity[]).map((id) => (
          <CityPin key={id} id={id} point={ARIZONA_CITIES[id]} stat={stats[id]} pulse={pulse === id} />
        ))}
      </svg>
      {!compact && (
        <div className="az-inset" aria-hidden="true">
          <p>Phoenix metro</p>
          <svg viewBox="0 0 200 156">
            <rect width="200" height="156" rx="16" fill="rgba(4,12,28,0.55)" />
            {(Object.keys(METRO_CITIES) as MapCity[]).map((id) => (
              <CityPin key={id} id={id} point={{ ...METRO_CITIES[id], label: ARIZONA_CITIES[id].label }} stat={stats[id]} pulse={pulse === id} inset />
            ))}
          </svg>
        </div>
      )}
    </div>
  );
}

function CityPin({
  id,
  point,
  stat,
  pulse,
  inset = false,
}: {
  id: MapCity;
  point: { x: number; y: number; label: string };
  stat: CityStat | null;
  pulse: boolean;
  inset?: boolean;
}) {
  const radius = stat ? pinRadius(stat.open, stat.month) : 5;
  const label = stat ? `${point.label}: ${stat.open} open, ${stat.month} filled this month` : point.label;
  const textX = id === "tempe" ? -34 : id === "mesa" ? 36 : 0;
  const textY = id === "chandler" ? radius + (inset ? 18 : 16) : -(inset ? 16 : radius + 6);
  return (
    <g className={pulse ? "az-pin is-pulsing" : "az-pin"} data-testid={inset ? undefined : `pin-${id}`} transform={`translate(${point.x} ${point.y})`}>
      <title>{label}</title>
      <circle className="az-halo" r={radius + 8} />
      <circle className="az-core" r={inset ? Math.max(6, radius * 0.7) : radius} />
      <text x={textX} y={textY} textAnchor="middle">
        {point.label}
      </text>
    </g>
  );
}
