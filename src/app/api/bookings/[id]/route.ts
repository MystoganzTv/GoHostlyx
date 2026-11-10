import { clientErrorMessage } from "@/lib/client-error";
import { localizedJson } from "@/lib/server-messages";
import { requireApiAccess } from "@/lib/access";
import { deleteBookingRecord, updateBookingRecord } from "@/lib/db";
import { normalizeManualBooking } from "@/lib/manual-entry";

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

    const formData = await request.formData();
    const booking = normalizeManualBooking(formData);
    const updated = await updateBookingRecord({
      ownerEmail,
      bookingId,
      booking,
    });

    if (!updated) {
      return await localizedJson({ error: "Booking not found." }, { status: 404 });
    }

    return await localizedJson({
      message: `Booking for ${booking.guestName} updated successfully.`,
    });
  } catch (error) {
    return await localizedJson(
      {
        error:
          clientErrorMessage(error, "The booking could not be updated."),
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
    const access = await requireApiAccess();

    if (access.response) {
      return access.response;
    }

    const { ownerEmail } = access;

    const bookingId = Number((await params).id);

    if (!Number.isFinite(bookingId) || bookingId <= 0) {
      return await localizedJson({ error: "Invalid booking id." }, { status: 400 });
    }

    const deleted = await deleteBookingRecord({
      ownerEmail,
      bookingId,
    });

    if (!deleted) {
      return await localizedJson({ error: "Booking not found." }, { status: 404 });
    }

    return await localizedJson({
      message: "Booking deleted successfully.",
    });
  } catch (error) {
    return await localizedJson(
      {
        error:
          clientErrorMessage(error, "The booking could not be deleted."),
      },
      { status: 400 },
    );
  }
}
