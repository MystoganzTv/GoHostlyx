import { NextResponse } from "next/server";
import { requireUserEmail } from "@/lib/auth";
import { syncIcalFeedById } from "@/lib/ical-feeds";

export const runtime = "nodejs";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const ownerEmail = await requireUserEmail();

    if (!ownerEmail) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const feedId = Number((await params).id);

    if (!Number.isFinite(feedId) || feedId <= 0) {
      return NextResponse.json({ error: "Invalid feed id." }, { status: 400 });
    }

    const result = await syncIcalFeedById({
      ownerEmail,
      feedId,
    });

    return NextResponse.json({
      message: `Synced ${result.eventCount} event${result.eventCount === 1 ? "" : "s"} just now.`,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "The iCal feed could not be synced.",
      },
      { status: 400 },
    );
  }
}
