"use client";

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="wrap board-main">
      <p className="eyebrow">Express Employment Professionals</p>
      <h1>The board hit a snag</h1>
      <p className="lede">Try again. If it keeps happening, refresh the page.</p>
      <button className="btn btn-primary" type="button" onClick={reset}>
        Try again
      </button>
    </main>
  );
}
