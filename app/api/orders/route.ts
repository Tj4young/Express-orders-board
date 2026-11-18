import { fail, ok, readJson, requireEditor } from "@/lib/http";
import { getRepository } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    requireEditor(request);
    const result = await getRepository().createOrder(await readJson(request));
    return ok(result, 201);
  } catch (error) {
    return fail(error);
  }
}
