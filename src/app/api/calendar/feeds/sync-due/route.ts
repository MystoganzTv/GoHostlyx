import { NextResponse } from "next/server";
import { requireUserEmail } from "@/lib/auth";
import { syncDueIcalFeeds } from "@/lib/ical-feeds";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const ownerEmail = await requireUserEmail();

    if (!ownerEmail) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const force = new URL(request.url).searchParams.get("force") === "1";
    const result = await syncDueIcalFeeds(ownerEmail, force ? { maxAgeMs: 0 } : undefined);

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "The saved iCal feeds could not be refreshed.",
      },
      { status: 400 },
    );
  }
}
