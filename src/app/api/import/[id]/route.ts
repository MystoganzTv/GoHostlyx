import { clientErrorMessage } from "@/lib/client-error";
import { localizedJson } from "@/lib/server-messages";
import { deleteImportBatch } from "@/lib/db";
import { requireApiAccess } from "@/lib/access";

export const runtime = "nodejs";

type Params = Promise<{ id: string }>;

export async function DELETE(
  _request: Request,
  { params }: { params: Params },
) {
  try {
    const access = await requireApiAccess();

    if (access.response) {
      return access.response;
    }

    const { ownerEmail } = access;

    const { id } = await params;
    const importId = Number(id);

    const result = await deleteImportBatch({
      ownerEmail,
      importId,
    });

    return await localizedJson({
      message: `Deleted ${result.deletedFileName} from ${result.deletedPropertyName}. Removed the data linked to that import batch.`,
    });
  } catch (error) {
    return await localizedJson(
      {
        error:
          clientErrorMessage(error, "The import could not be deleted."),
      },
      { status: 400 },
    );
  }
}
