import "server-only";

import { BoardError } from "./board";
import { passcodeMatches } from "./passcode";

export function expectedPasscode(): string {
  return process.env.TEAM_PASSCODE?.trim() ?? "";
}

export function assertPasscode(headerValue: string | null): void {
  const expected = expectedPasscode();
  if (!expected) {
    throw new BoardError(
      "TEAM_PASSCODE is not set on the server yet. Add it in the Vercel project settings, then redeploy.",
      503,
    );
  }
  if (!passcodeMatches(headerValue, expected)) {
    throw new BoardError("That passcode didn't match.", 401);
  }
}
