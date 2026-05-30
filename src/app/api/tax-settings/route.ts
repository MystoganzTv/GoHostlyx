import { NextResponse } from "next/server";
import { requireUserEmail } from "@/lib/auth";
import { getUserSettings, upsertUserSettings } from "@/lib/db";
import { normalizeCountryCode } from "@/lib/markets";
import { normalizeTaxRate } from "@/lib/tax";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const ownerEmail = await requireUserEmail();

    if (!ownerEmail) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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

    return NextResponse.json({
      message: `Saved tax defaults for ${taxCountryCode}.`,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "The tax estimation settings could not be saved.",
      },
      { status: 400 },
    );
  }
}
