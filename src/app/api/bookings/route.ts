import { NextResponse } from "next/server";
import { requireUserEmail } from "@/lib/auth";
import { getPropertyDefinitions, insertManualBooking } from "@/lib/db";
import { normalizeManualBooking } from "@/lib/manual-entry";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const ownerEmail = await requireUserEmail();

    if (!ownerEmail) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const properties = await getPropertyDefinitions(ownerEmail);

    if (properties.length === 0) {
      return NextResponse.json(
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

    return NextResponse.json({
      message: `Booking for ${booking.guestName} added successfully.`,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "The booking could not be saved.",
      },
      { status: 400 },
    );
  }
}
