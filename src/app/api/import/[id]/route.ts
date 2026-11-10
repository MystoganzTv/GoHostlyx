import { NextResponse } from "next/server";
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

    return NextResponse.json({
      message: `Deleted ${result.deletedFileName} from ${result.deletedPropertyName}. Removed the data linked to that import batch.`,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "The import could not be deleted.",
      },
      { status: 400 },
    );
  }
}
