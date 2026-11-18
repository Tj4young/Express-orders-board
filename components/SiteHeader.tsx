"use client";

import Link from "next/link";

import { IconLock, IconSound } from "./icons";
import { useBoard } from "./BoardProvider";

export type NavKey = "tempe" | "mesa" | "battle" | "wins";

const LINKS: { href: string; key: NavKey; label: string }[] = [
  { href: "/tempe", key: "tempe", label: "Tempe" },
  { href: "/mesa", key: "mesa", label: "Mesa" },
  { href: "/battle", key: "battle", label: "Battle TV" },
  { href: "/wins", key: "wins", label: "Wins" },
];

export function SiteHeader({ active }: { active: NavKey }) {
  const { unlocked, lock, openUnlock, soundOn, setSoundOn, online, loading } = useBoard();

  return (
    <header className="site-header">
      <a className="skip" href="#content">
        Skip to the board
      </a>
      <div className="header-inner">
        <Link href="/tempe" className="wordmark" aria-label="Express Employment Professionals, Open Orders Board">
          <span className="wordmark-express">EXPRESS</span>
          <span className="wordmark-sub">Employment Professionals</span>
        </Link>
        <p className="header-title">
          Open Orders
          <span>Tempe · Mesa</span>
        </p>
        <nav className="nav" aria-label="Boards">
          {LINKS.map((link) => (
            <Link key={link.key} href={link.href} aria-current={link.key === active ? "page" : undefined}>
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="header-actions">
          <span className={online ? "live" : "live live-off"}>
            <span className="live-dot" />
            {loading ? "Loading" : online ? "Live" : "Reconnecting"}
          </span>
          <button
            className="btn btn-on-red"
            type="button"
            aria-pressed={soundOn}
            onClick={() => setSoundOn(!soundOn)}
          >
            <IconSound on={soundOn} />
            {soundOn ? "Sound on" : "Sound off"}
          </button>
          {unlocked ? (
            <button className="btn btn-on-red" type="button" onClick={lock}>
              <IconLock open />
              Lock
            </button>
          ) : (
            <button className="btn btn-on-red" type="button" onClick={openUnlock} data-testid="unlock">
              <IconLock open={false} />
              Unlock
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
