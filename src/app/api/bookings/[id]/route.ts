import { NextResponse } from "next/server";
import { requireUserEmail } from "@/lib/auth";
import { deleteBookingRecord, updateBookingRecord } from "@/lib/db";
import { normalizeManualBooking } from "@/lib/manual-entry";

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

    const formData = await request.formData();
    const booking = normalizeManualBooking(formData);
    const updated = await updateBookingRecord({
      ownerEmail,
      bookingId,
      booking,
    });

    if (!updated) {
      return NextResponse.json({ error: "Booking not found." }, { status: 404 });
    }

    return NextResponse.json({
      message: `Booking for ${booking.guestName} updated successfully.`,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "The booking could not be updated.",
      },
      { status: 400 },
    );
  }
}

export async function DELETE(
  _request: Request,
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

    const deleted = await deleteBookingRecord({
      ownerEmail,
      bookingId,
    });

    if (!deleted) {
      return NextResponse.json({ error: "Booking not found." }, { status: 404 });
    }

    return NextResponse.json({
      message: "Booking deleted successfully.",
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "The booking could not be deleted.",
      },
      { status: 400 },
    );
  }
}
