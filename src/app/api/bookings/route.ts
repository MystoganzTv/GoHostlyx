import { clientErrorMessage } from "@/lib/client-error";
import { localizedJson } from "@/lib/server-messages";
import { requireApiAccess } from "@/lib/access";
import { getPropertyDefinitions, insertManualBooking } from "@/lib/db";
import { normalizeManualBooking } from "@/lib/manual-entry";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const access = await requireApiAccess();

    if (access.response) {
      return access.response;
    }

    const { ownerEmail } = access;

    const properties = await getPropertyDefinitions(ownerEmail);

    if (properties.length === 0) {
      return await localizedJson(
        { error: "Create your first property before adding bookings." },
        { status: 400 },
      );
    }

    const formData = await request.formData();
    const booking = normalizeManualBooking(formData);
    await insertManualBooking({
      ownerEmail,
      booking,
    });

    return await localizedJson({
      message: `Booking for ${booking.guestName} added successfully.`,
    });
  } catch (error) {
    return await localizedJson(
      {
        error:
          clientErrorMessage(error, "The booking could not be saved."),
      },
      { status: 400 },
    );
  }
}
