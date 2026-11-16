import { localizedJson } from "@/lib/server-messages";
import { requireApiAccess } from "@/lib/access";
import { getImportedWorkbookMatches } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const access = await requireApiAccess();

    if (access.response) {
      return access.response;
    }

    const { ownerEmail } = access;

    const payload = (await request.json()) as { hashes?: unknown };
    const hashes = Array.isArray(payload.hashes)
      ? payload.hashes.filter((value): value is string => typeof value === "string")
      : [];

    const matches = await getImportedWorkbookMatches(ownerEmail, hashes);

    return await localizedJson({ matches });
  } catch {
    return await localizedJson(
      { error: "The duplicate check could not be completed." },
      { status: 400 },
    );
  }
}
