import { NextResponse } from "next/server";
import { requireUserEmail } from "@/lib/auth";
import { disconnectIcalFeed } from "@/lib/db";

export const runtime = "nodejs";

export async function DELETE(
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

    await disconnectIcalFeed({
      ownerEmail,
      feedId,
    });

    return NextResponse.json({
      message: "Feed disconnected.",
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "The iCal feed could not be disconnected.",
      },
      { status: 400 },
    );
  }
}
