import { NextResponse } from "next/server";
import { requireUserEmail } from "@/lib/auth";
import { getPropertyDefinitions } from "@/lib/db";
import { saveAndSyncIcalFeed, validateIcalFeedUrl } from "@/lib/ical-feeds";
import type { CalendarEventSource } from "@/lib/types";

export const runtime = "nodejs";

function normalizeSource(value: FormDataEntryValue | null): CalendarEventSource {
  const normalized = String(value ?? "other").trim().toLowerCase();

  if (normalized === "airbnb" || normalized === "booking" || normalized === "vrbo") {
    return normalized;
  }

  return "other";
}

export async function POST(request: Request) {
  try {
    const ownerEmail = await requireUserEmail();

    if (!ownerEmail) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const propertyName = String(formData.get("propertyName") ?? "").trim();
    const unitName = String(formData.get("unitName") ?? "").trim();
    const source = normalizeSource(formData.get("source"));
    const icalUrl = String(formData.get("icalUrl") ?? "").trim();

    if (!propertyName) {
      return NextResponse.json({ error: "Choose a property first." }, { status: 400 });
    }

    if (!icalUrl) {
      return NextResponse.json({ error: "Paste the public iCal URL first." }, { status: 400 });
    }

    const normalizedFeedUrl = validateIcalFeedUrl(icalUrl);

    const properties = await getPropertyDefinitions(ownerEmail);
    const selectedProperty =
      properties.find((property) => property.name.trim().toLowerCase() === propertyName.toLowerCase()) ?? null;

    if (!selectedProperty) {
      return NextResponse.json({ error: "That property no longer exists." }, { status: 400 });
    }

    if (
      unitName &&
      !selectedProperty.units.some(
        (unit) => unit.name.trim().toLowerCase() === unitName.toLowerCase(),
      )
    ) {
      return NextResponse.json({ error: "That listing no longer exists on the property." }, { status: 400 });
    }

    const result = await saveAndSyncIcalFeed({
      ownerEmail,
      propertyId: selectedProperty.id ?? 0,
      propertyName: selectedProperty.name,
      listingId:
        selectedProperty.units.find(
          (unit) => unit.name.trim().toLowerCase() === unitName.toLowerCase(),
        )?.id ?? null,
      listingName: unitName,
      source,
      feedUrl: normalizedFeedUrl,
    });

    return NextResponse.json({
      message: `Saved feed and synced ${result.eventCount} iCal event${result.eventCount === 1 ? "" : "s"} for ${unitName || "Primary listing"}.`,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "The iCal feed could not be imported.",
      },
      { status: 400 },
    );
  }
}
