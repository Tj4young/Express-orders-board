import { fail, ok, readJson, requireEditor } from "@/lib/http";
import { getRepository } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    requireEditor(request);
    const state = await getRepository().createRecruiter(await readJson(request));
    return ok({ state, celebration: null }, 201);
  } catch (error) {
    return fail(error);
  }
}
