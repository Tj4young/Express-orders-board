import { fail, ok } from "@/lib/http";
import { getRepository } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return ok(await getRepository().read());
  } catch (error) {
    return fail(error);
  }
}
