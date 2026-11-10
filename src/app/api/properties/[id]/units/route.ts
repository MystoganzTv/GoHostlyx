import { clientErrorMessage } from "@/lib/client-error";
import { localizedJson } from "@/lib/server-messages";
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
      return await localizedJson({ error: "Invalid property id." }, { status: 400 });
    }

    const formData = await request.formData();
    const unitName = String(formData.get("name") ?? "").trim();
    const unitId = await createPropertyUnit({
      ownerEmail,
      propertyId,
      name: unitName,
    });

    return await localizedJson({
      unitId,
      message: `Listing "${unitName}" created successfully.`,
    });
  } catch (error) {
    return await localizedJson(
      {
        error:
          clientErrorMessage(error, "The unit could not be created."),
      },
      { status: 400 },
    );
  }
}
