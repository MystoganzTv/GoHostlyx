import { clientErrorMessage } from "@/lib/client-error";
import { localizedJson } from "@/lib/server-messages";
import { requireUserEmail } from "@/lib/auth";
import { getUserSettings, upsertUserSettings } from "@/lib/db";
import { normalizeCountryCode } from "@/lib/markets";
import { normalizeTaxRate } from "@/lib/tax";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const ownerEmail = await requireUserEmail();

    if (!ownerEmail) {
      return await localizedJson({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const taxCountryCode = normalizeCountryCode(
      String(formData.get("taxCountryCode") ?? "US").trim(),
    );
    const taxRate = normalizeTaxRate(formData.get("taxRate")?.toString() ?? "");
    const currentSettings = await getUserSettings(ownerEmail, ownerEmail);

    await upsertUserSettings({
      ownerEmail,
      businessName: currentSettings.businessName,
      primaryCountryCode: currentSettings.primaryCountryCode,
      taxCountryCode,
      taxRate,
    });

    return await localizedJson({
      message: `Saved tax defaults for ${taxCountryCode}.`,
    });
  } catch (error) {
    return await localizedJson(
      {
        error:
          clientErrorMessage(error, "The tax estimation settings could not be saved."),
      },
      { status: 400 },
    );
  }
}
