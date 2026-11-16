import { requireApiAccess } from "@/lib/access";
import { localizedJson } from "@/lib/server-messages";
import { listDeletedItems } from "@/lib/trash";

export const runtime = "nodejs";

export async function GET() {
  const access = await requireApiAccess();

  if (access.response) {
    return access.response;
  }

  return localizedJson({ items: await listDeletedItems(access.ownerEmail) });
}
