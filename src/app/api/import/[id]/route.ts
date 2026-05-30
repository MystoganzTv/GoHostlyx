import { NextResponse } from "next/server";
import { deleteImportBatch } from "@/lib/db";
import { requireUserEmail } from "@/lib/auth";

export const runtime = "nodejs";

type Params = Promise<{ id: string }>;

export async function DELETE(
  _request: Request,
  { params }: { params: Params },
) {
  try {
    const ownerEmail = await requireUserEmail();

    if (!ownerEmail) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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
