import { clientErrorMessage } from "@/lib/client-error";
import { localizedJson } from "@/lib/server-messages";
import { requireApiAccess } from "@/lib/access";
import { updateBookingReviewState } from "@/lib/db";

export const runtime = "nodejs";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const access = await requireApiAccess();

    if (access.response) {
      return access.response;
    }

    const { ownerEmail } = access;

    const bookingId = Number((await params).id);

    if (!Number.isFinite(bookingId) || bookingId <= 0) {
      return await localizedJson({ error: "Invalid booking id." }, { status: 400 });
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
      return await localizedJson({ error: "Booking not found." }, { status: 404 });
    }

    return await localizedJson({
      message:
        reviewStatus === "ready"
          ? "Booking marked as reviewed."
          : "Booking moved back to review.",
    });
  } catch (error) {
    return await localizedJson(
      {
        error:
          clientErrorMessage(error, "The booking review state could not be updated."),
      },
      { status: 400 },
    );
  }
}
