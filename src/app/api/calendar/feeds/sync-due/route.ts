import { NextResponse } from "next/server";
import { requireApiAccess } from "@/lib/access";
import { syncDueIcalFeeds } from "@/lib/ical-feeds";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const access = await requireApiAccess();

    if (access.response) {
      return access.response;
    }

    const { ownerEmail } = access;

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
