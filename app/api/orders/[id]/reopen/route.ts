import { fail, ok, requireEditor } from "@/lib/http";
import { getRepository } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    requireEditor(request);
    const { id } = await context.params;
    return ok(await getRepository().reopen(id), 201);
  } catch (error) {
    return fail(error);
  }
}
