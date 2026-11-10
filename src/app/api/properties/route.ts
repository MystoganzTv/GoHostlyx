import { clientErrorMessage } from "@/lib/client-error";
import { localizedJson } from "@/lib/server-messages";
import { requireApiAccess } from "@/lib/access";
import { createPropertyDefinition } from "@/lib/db";
import { normalizeCountryCode } from "@/lib/markets";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const access = await requireApiAccess();

    if (access.response) {
      return access.response;
    }

    const { ownerEmail } = access;

    const formData = await request.formData();
    const propertyName = String(formData.get("name") ?? "").trim();
    const countryCode = normalizeCountryCode(String(formData.get("countryCode") ?? "US"));
    const propertyId = await createPropertyDefinition({
      ownerEmail,
      name: propertyName,
      countryCode,
    });

    return await localizedJson({
      propertyId,
      message: `Property "${propertyName}" created successfully.`,
    });
  } catch (error) {
    return await localizedJson(
      {
        error:
          clientErrorMessage(error, "The property could not be created."),
      },
      { status: 400 },
    );
  }
}
