import { NextResponse } from "next/server";
import { requireUserEmail } from "@/lib/auth";
import { updateBookingReviewState } from "@/lib/db";

export const runtime = "nodejs";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const ownerEmail = await requireUserEmail();

    if (!ownerEmail) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const bookingId = Number((await params).id);

    if (!Number.isFinite(bookingId) || bookingId <= 0) {
      return NextResponse.json({ error: "Invalid booking id." }, { status: 400 });
    }

    const payload = (await request.json().catch(() => ({}))) as {
      reviewStatus?: "ready" | "needs_review";
      reviewReason?: string;
    };

    const reviewStatus = payload.reviewStatus === "needs_review" ? "needs_review" : "ready";
    const updated = await updateBookingReviewState({
      ownerEmail,
      bookingId,
      reviewStatus,
      reviewReason: payload.reviewReason ?? "",
    });

    if (!updated) {
      return NextResponse.json({ error: "Booking not found." }, { status: 404 });
    }

    return NextResponse.json({
      message:
        reviewStatus === "ready"
          ? "Booking marked as reviewed."
          : "Booking moved back to review.",
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "The booking review state could not be updated.",
      },
      { status: 400 },
    );
  }
}
