import { redirect } from "next/navigation";
import { DashboardWidgetLab } from "@/components/dashboard-widget-lab";
import { getAuthSession } from "@/lib/auth";
import { buildDashboardView, getDashboardFilters } from "@/lib/dashboard";
import {
  getBookings,
  getExpenses,
  getLatestImport,
  getPropertyDefinitions,
  getUserSettings,
} from "@/lib/db";

export const runtime = "nodejs";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function DashboardLabPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await getAuthSession();
  const ownerEmail = session?.user?.email?.toLowerCase();

  if (!session?.user?.email || !ownerEmail) {
    redirect("/login");
  }

  const userName = session.user.name ?? session.user.email ?? "Host";
  const properties = await getPropertyDefinitions(ownerEmail);

  if (properties.length === 0) {
    redirect("/dashboard/properties?setup=1");
  }

  const bookings = await getBookings(ownerEmail);
  const expenses = await getExpenses(ownerEmail);
  const latestImport = await getLatestImport(ownerEmail);
  const userSettings = await getUserSettings(ownerEmail, userName);
  const resolvedSearchParams = await searchParams;
  const filters = getDashboardFilters(
    resolvedSearchParams,
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

  return (
    <DashboardWidgetLab
      view={view}
      latestImport={latestImport}
      userName={userName}
      userEmail={ownerEmail}
      businessName={userSettings.businessName}
      currencyCode={view.displayCurrencyCode}
    />
  );
}
