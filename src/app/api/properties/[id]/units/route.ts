import { clientErrorMessage } from "@/lib/client-error";
import { NextResponse } from "next/server";
import { requireApiAccess } from "@/lib/access";
import { createPropertyUnit } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const access = await requireApiAccess();

    if (access.response) {
      return access.response;
    }

    const { ownerEmail } = access;

    const propertyId = Number((await params).id);

    if (!Number.isFinite(propertyId) || propertyId <= 0) {
      return NextResponse.json({ error: "Invalid property id." }, { status: 400 });
    }

    const formData = await request.formData();
    const unitName = String(formData.get("name") ?? "").trim();
    const unitId = await createPropertyUnit({
      ownerEmail,
      propertyId,
      name: unitName,
    });

    return NextResponse.json({
      unitId,
      message: `Listing "${unitName}" created successfully.`,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          clientErrorMessage(error, "The unit could not be created."),
      },
      { status: 400 },
    );
  }
}
