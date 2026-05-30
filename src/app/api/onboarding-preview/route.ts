import { NextResponse } from "next/server";
import { requireUserEmail } from "@/lib/auth";
import { buildDashboardView, getDashboardFilters } from "@/lib/dashboard";
import {
  getBookings,
  getExpenses,
  getPropertyDefinitions,
  getUserSettings,
} from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  try {
    const ownerEmail = await requireUserEmail();

    if (!ownerEmail) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const [bookings, expenses, properties, userSettings] = await Promise.all([
      getBookings(ownerEmail),
      getExpenses(ownerEmail),
      getPropertyDefinitions(ownerEmail),
      getUserSettings(ownerEmail, ownerEmail),
    ]);

    const hasData = bookings.length > 0 || expenses.length > 0;

    if (!hasData) {
      return NextResponse.json({
        hasData: false,
        netProfit: 0,
        currencyCode: userSettings.currencyCode,
      });
    }

    const filters = getDashboardFilters(
      {},
      bookings,
      expenses,
      properties,
      userSettings.primaryCountryCode,
    );
    const view = buildDashboardView({
      bookings,
      expenses,
      filters,
      properties,
      fallbackCountryCode: userSettings.primaryCountryCode,
      taxCountryCode: userSettings.taxCountryCode,
      taxRate: userSettings.taxRate,
    });

    return NextResponse.json({
      hasData: true,
      netProfit: view.metrics.netProfit,
      currencyCode: view.displayCurrencyCode,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "The onboarding preview could not be loaded.",
      },
      { status: 400 },
    );
  }
}
