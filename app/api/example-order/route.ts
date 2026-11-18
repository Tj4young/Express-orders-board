import { fail, ok, requireEditor } from "@/lib/http";
import { getRepository } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    requireEditor(request);
    const state = await getRepository().addExample();
    return ok({ state, celebration: null }, 201);
  } catch (error) {
    return fail(error);
  }
}
