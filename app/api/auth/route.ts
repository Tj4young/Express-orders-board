import { BoardError } from "@/lib/board";
import { expectedPasscode } from "@/lib/auth";
import { fail, ok, readJson } from "@/lib/http";
import { passcodeMatches } from "@/lib/passcode";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await readJson(request);
    const passcode =
      body && typeof body === "object" && typeof (body as { passcode?: unknown }).passcode === "string"
        ? (body as { passcode: string }).passcode
        : "";
    const expected = expectedPasscode();
    if (!expected) {
      throw new BoardError(
        "TEAM_PASSCODE is not set on the server yet. Add it in the Vercel project settings, then redeploy.",
        503,
      );
    }
    if (!passcodeMatches(passcode, expected)) {
      throw new BoardError("That passcode didn't match.", 401);
    }
    return ok({ ok: true });
  } catch (error) {
    return fail(error);
  }
}
