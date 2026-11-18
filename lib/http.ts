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
  try {
    return await request.json();
  } catch {
    throw new BoardError("The request was empty or invalid.");
  }
}

export function requireEditor(request: Request) {
  assertPasscode(request.headers.get("x-team-passcode"));
}
