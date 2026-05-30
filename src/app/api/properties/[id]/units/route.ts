import { NextResponse } from "next/server";
import { requireUserEmail } from "@/lib/auth";
import { createPropertyUnit } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const ownerEmail = await requireUserEmail();

    if (!ownerEmail) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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
          error instanceof Error ? error.message : "The unit could not be created.",
      },
      { status: 400 },
    );
  }
}
