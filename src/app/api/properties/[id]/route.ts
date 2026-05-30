import { NextResponse } from "next/server";
import { requireUserEmail } from "@/lib/auth";
import { deletePropertyDefinition, updatePropertyDefinition } from "@/lib/db";
import { normalizeCountryCode } from "@/lib/markets";

export const runtime = "nodejs";

export async function PATCH(
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
    const propertyName = String(formData.get("name") ?? "").trim();
    const countryCode = normalizeCountryCode(String(formData.get("countryCode") ?? "US"));

    await updatePropertyDefinition({
      ownerEmail,
      propertyId,
      name: propertyName,
      countryCode,
    });

    return NextResponse.json({
      message: `Property renamed to "${propertyName}".`,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "The property could not be updated.",
      },
      { status: 400 },
    );
  }
}

export async function DELETE(
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

    const { searchParams } = new URL(request.url);
    const deleteLinkedData = searchParams.get("deleteLinkedData") === "true";

    const result = await deletePropertyDefinition({
      ownerEmail,
      propertyId,
      deleteLinkedData,
    });

    return NextResponse.json({
      message:
        result.deletedLinkedData
          ? result.removedLastProperty
            ? `Deleted ${result.deletedPropertyName} and removed ${result.deletedImportsCount} imports, ${result.deletedBookingsCount} bookings, and ${result.deletedExpensesCount} expenses. No properties remain in this workspace.`
            : `Deleted ${result.deletedPropertyName} and removed ${result.deletedImportsCount} imports, ${result.deletedBookingsCount} bookings, and ${result.deletedExpensesCount} expenses linked to it.`
          : "Property deleted successfully.",
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "The property could not be deleted.",
      },
      { status: 400 },
    );
  }
}
