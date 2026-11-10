import { clientErrorMessage } from "@/lib/client-error";
import { NextResponse } from "next/server";
import { requireApiAccess } from "@/lib/access";
import { disconnectIcalFeed } from "@/lib/db";

export const runtime = "nodejs";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const access = await requireApiAccess();

    if (access.response) {
      return access.response;
    }

    const { ownerEmail } = access;

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
        error: clientErrorMessage(error, "The iCal feed could not be disconnected."),
      },
      { status: 400 },
    );
  }
}
