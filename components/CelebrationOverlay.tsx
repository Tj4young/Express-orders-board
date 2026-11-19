"use client";

import { useEffect, useRef, useState } from "react";

import { fillCelebrationTitle, formatNameList } from "@/lib/credit";
import { formatPrettyDateTime } from "@/lib/time";

import { ClientLogo } from "./ClientLogo";
import { useBoard } from "./BoardProvider";

const COLORS = ["#0096D6", "#0077C0", "#005288", "#ffffff", "#E9B632", "#7ec8ee"];

type Particle = {
  x: number;
  y: number;
  w: number;
  h: number;
  vx: number;
  vy: number;
  rot: number;
  vr: number;
  color: string;
  gravity: number;
};

function makeBurst(width: number, height: number, count: number): Particle[] {
  return Array.from({ length: count }, () => {
    const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.35;
    const speed = 5 + Math.random() * 9;
    return {
      x: width * (0.15 + Math.random() * 0.7),
      y: height * (0.28 + Math.random() * 0.2),
      w: 7 + Math.random() * 8,
      h: 10 + Math.random() * 12,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.28,
      color: COLORS[Math.floor(Math.random() * COLORS.length)] ?? "#0077C0",
      gravity: 0.11 + Math.random() * 0.08,
    };
  });
}

export function CelebrationOverlay() {
  const { celebration, dismissCelebration, undoFill, pendingId, unlocked, state } = useBoard();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (!celebration) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") dismissCelebration();
    };
    window.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const timer = window.setTimeout(() => dismissCelebration(), 9000);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
      window.clearTimeout(timer);
    };
  }, [celebration, dismissCelebration]);

  useEffect(() => {
    if (!celebration || reduced) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    let particles: Particle[] = [];
    let frame = 0;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = canvas.offsetWidth * dpr;
      canvas.height = canvas.offsetHeight * dpr;
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const orderFilled = celebration.kind !== "fill";
    const burst = orderFilled ? 180 : 120;
    particles = makeBurst(canvas.offsetWidth, canvas.offsetHeight, burst);

    let raf = 0;
    const draw = () => {
      const width = canvas.offsetWidth;
      const height = canvas.offsetHeight;
      context.clearRect(0, 0, width, height);
      if (frame === 8 || frame === 18) {
        particles.push(...makeBurst(width, height, orderFilled ? 40 : 28));
      }
      for (const particle of particles) {
        particle.vy += particle.gravity;
        particle.x += particle.vx;
        particle.y += particle.vy;
        particle.rot += particle.vr;
        context.save();
        context.translate(particle.x, particle.y);
        context.rotate(particle.rot);
        context.fillStyle = particle.color;
        context.fillRect(-particle.w / 2, -particle.h / 2, particle.w, particle.h);
        context.restore();
      }
      frame += 1;
      if (frame < 420) raf = window.requestAnimationFrame(draw);
    };
    raf = window.requestAnimationFrame(draw);
    window.addEventListener("resize", resize);
    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, [celebration, reduced]);

  if (!celebration) return null;

  const orderFilled = celebration.kind !== "fill";
  const names = formatNameList(celebration.contributors?.length ? celebration.contributors : [celebration.recruiterName]);

  return (
    <div className="celebration" role="dialog" aria-modal="true" aria-labelledby="celebration-title" data-testid="celebration">
      {!reduced && <canvas ref={canvasRef} className="confetti" />}
      <div
        className={orderFilled ? "celebration-card is-complete" : "celebration-card is-fill"}
        data-celebration-kind={orderFilled ? "filled" : "fill"}
      >
        <ClientLogo
          client={celebration.client}
          logo={state?.orders.find((order) => order.id === celebration.orderId)?.logo}
          size={orderFilled ? 76 : 64}
        />
        <p className="celebration-kicker">{orderFilled ? "Order filled" : "New fill"}</p>
        <h2 id="celebration-title">
          {orderFilled
            ? `🎉 ${celebration.officeName} filled ${celebration.position} at ${celebration.client}!`
            : fillCelebrationTitle(celebration)}
        </h2>
        <p className="celebration-sub">
          {orderFilled ? (
            <>
              Placed by {names} · {formatPrettyDateTime(celebration.at)}
            </>
          ) : (
            <>
              {celebration.officeName} · {formatPrettyDateTime(celebration.at)}
            </>
          )}
        </p>
        <div className="celebration-actions">
          {unlocked && (
            <button
              className="btn btn-ghost"
              type="button"
              disabled={pendingId === celebration.orderId}
              onClick={() => void undoFill(celebration.orderId)}
            >
              Undo fill
            </button>
          )}
          <button className="btn btn-primary" type="button" onClick={dismissCelebration} data-testid="celebration-dismiss" autoFocus>
            Keep going
          </button>
        </div>
      </div>
    </div>
  );
}
