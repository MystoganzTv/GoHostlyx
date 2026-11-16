import { requireApiAccess } from "@/lib/access";
import { clientErrorMessage } from "@/lib/client-error";
import { localizedJson } from "@/lib/server-messages";
import { restoreDeletedItem } from "@/lib/trash";

export const runtime = "nodejs";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await requireApiAccess();

  if (access.response) {
    return access.response;
  }

  const itemId = Number((await params).id);

  if (!Number.isFinite(itemId) || itemId <= 0) {
    return localizedJson({ error: "That item is no longer in Recently deleted." }, { status: 404 });
  }

  try {
    const result = await restoreDeletedItem(access.ownerEmail, itemId);
    return localizedJson({ message: `Restored ${result.label}.` });
  } catch (error) {
    return localizedJson(
      { error: clientErrorMessage(error, "The item could not be restored.") },
      { status: 400 },
    );
  }
}
