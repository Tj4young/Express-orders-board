import Link from "next/link";

export default function NotFound() {
  return (
    <main className="wrap board-main">
      <p className="eyebrow">Express Employment Professionals</p>
      <h1>That page isn&apos;t on the board</h1>
      <p className="lede">Head back to an office board or the Battle TV.</p>
      <p>
        <Link href="/tempe">Express Tempe</Link>
        {" · "}
        <Link href="/mesa">Express Mesa</Link>
        {" · "}
        <Link href="/battle">Battle TV</Link>
      </p>
    </main>
  );
}
