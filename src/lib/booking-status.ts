import { format } from "date-fns";
import type { BookingRecord } from "@/lib/types";

export type BookingStatusTone = "neutral" | "active" | "success" | "warning" | "danger";

export type BookingStatusState = {
  label: string;
  tone: BookingStatusTone;
};

function normalizeStatus(value: string) {
  return value.trim().toLowerCase();
}

export function getBookingStatusState(
  booking: Pick<BookingRecord, "checkIn" | "checkout" | "overbookingStatus">,
): BookingStatusState {
  const rawStatus = normalizeStatus(booking.overbookingStatus);

  if (rawStatus.includes("cancel")) {
    return { label: "Canceled", tone: "danger" };
  }

  if (rawStatus.includes("currently hosting") || rawStatus.includes("hosting")) {
    return { label: "Hosting", tone: "active" };
  }

  if (rawStatus.includes("past guest")) {
    return { label: "Completed", tone: "success" };
  }

  if (rawStatus.includes("trip change")) {
    return { label: "Pending change", tone: "warning" };
  }

  if (rawStatus.includes("no show") || rawStatus.includes("noshow")) {
    return { label: "No-show", tone: "warning" };
  }

  if (rawStatus.includes("blocked") || rawStatus.includes("closed")) {
    return { label: "Blocked", tone: "neutral" };
  }

  if (
    rawStatus.includes("pending") ||
    rawStatus.includes("awaiting") ||
    rawStatus.includes("request")
  ) {
    return { label: "Pending", tone: "warning" };
  }

  const today = format(new Date(), "yyyy-MM-dd");

  if (booking.checkIn && booking.checkout) {
    if (today < booking.checkIn) {
      return { label: "Confirmed", tone: "success" };
    }

    if (today >= booking.checkIn && today < booking.checkout) {
      return { label: "Hosting", tone: "active" };
    }

    if (today >= booking.checkout) {
      return { label: "Completed", tone: "success" };
    }
  }

  if (
    rawStatus.includes("confirm") ||
    rawStatus.includes("accept") ||
    rawStatus.includes("booked") ||
    rawStatus.includes("reserved")
  ) {
    return { label: "Confirmed", tone: "success" };
  }

  return { label: "Confirmed", tone: "success" };
}
