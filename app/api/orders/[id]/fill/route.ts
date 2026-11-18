import { BoardError } from "@/lib/board";
import { fail, ok, readJson, requireEditor } from "@/lib/http";
import { getRepository } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    requireEditor(request);
    const { id } = await context.params;
    const body = await readJson(request);
    const action = body && typeof body === "object" ? (body as { action?: unknown }).action : null;
    if (action !== "increment" && action !== "undo") {
      throw new BoardError("Unknown fill action.");
    }
    return ok(await getRepository().fill(id, action));
  } catch (error) {
    return fail(error);
  }
}
