import "server-only";

import { NextResponse } from "next/server";

import { assertPasscode } from "./auth";
import { BoardError } from "./board";

export function ok(data: unknown, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export function fail(error: unknown) {
  if (error instanceof BoardError) {
    return NextResponse.json({ error: error.message }, { status: error.status, headers: { "Cache-Control": "no-store" } });
  }
  console.error(error);
  return NextResponse.json(
    { error: "Something went wrong. Try again." },
    { status: 500, headers: { "Cache-Control": "no-store" } },
  );
}

export async function readJson(request: Request): Promise<unknown> {
  let text = "";
  try {
    text = await request.text();
  } catch {
    throw new BoardError("The order didn't come through. If you added a logo, try a smaller photo.");
  }
  if (!text) throw new BoardError("The order was empty. If you added a logo, try a smaller photo.");
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new BoardError("The order was cut off before it saved. Remove the logo or use a smaller photo, then try again.");
  }
}

export function requireEditor(request: Request) {
  assertPasscode(request.headers.get("x-team-passcode"));
}
