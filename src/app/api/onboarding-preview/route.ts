import { clientErrorMessage } from "@/lib/client-error";
import { localizedJson } from "@/lib/server-messages";
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
      return await localizedJson({ error: "Unauthorized" }, { status: 401 });
    }

    const [bookings, expenses, properties, userSettings] = await Promise.all([
      getBookings(ownerEmail),
      getExpenses(ownerEmail),
      getPropertyDefinitions(ownerEmail),
      getUserSettings(ownerEmail, ownerEmail),
    ]);

    const hasData = bookings.length > 0 || expenses.length > 0;

    if (!hasData) {
      return await localizedJson({
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

    return await localizedJson({
      hasData: true,
      netProfit: view.metrics.netProfit,
      currencyCode: view.displayCurrencyCode,
    });
  } catch (error) {
    return await localizedJson(
      {
        error:
          clientErrorMessage(error, "The onboarding preview could not be loaded."),
      },
      { status: 400 },
    );
  }
}
