import { fail, ok, readJson, requireEditor } from "@/lib/http";
import { getRepository } from "@/lib/store";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: Context) {
  try {
    requireEditor(request);
    const { id } = await context.params;
    const state = await getRepository().updateRecruiter(id, await readJson(request));
    return ok({ state, celebration: null });
  } catch (error) {
    return fail(error);
  }
}

export async function DELETE(request: Request, context: Context) {
  try {
    requireEditor(request);
    const { id } = await context.params;
    const state = await getRepository().deleteRecruiter(id);
    return ok({ state, celebration: null });
  } catch (error) {
    return fail(error);
  }
}
