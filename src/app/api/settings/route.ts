import { NextResponse } from "next/server";
import { requireUserEmail } from "@/lib/auth";
import { upsertUserSettings } from "@/lib/db";
import { normalizeCountryCode } from "@/lib/markets";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const ownerEmail = await requireUserEmail();

    if (!ownerEmail) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const businessName = String(formData.get("businessName") ?? "").trim();
    const primaryCountryCode = normalizeCountryCode(
      String(formData.get("primaryCountryCode") ?? "US").trim(),
    );

    if (!businessName) {
      return NextResponse.json(
        { error: "Add a business name before saving settings." },
        { status: 400 },
      );
    }

    await upsertUserSettings({
      ownerEmail,
      businessName,
      primaryCountryCode,
    });

    return NextResponse.json({
      message: `Saved ${businessName}. Hostlyx will now use ${primaryCountryCode} as the default reporting market when all countries are selected.`,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "The business settings could not be saved.",
      },
      { status: 400 },
    );
  }
}
