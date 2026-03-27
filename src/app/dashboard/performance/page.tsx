import { redirect } from "next/navigation";
import { buildDashboardView, getDashboardFilters } from "@/lib/dashboard";
import { getAuthSession } from "@/lib/auth";
import {
  getBookings,
  getExpenses,
  getLatestImport,
  getPropertyDefinitions,
  getUserSettings,
} from "@/lib/db";
import { FilterBar } from "@/components/filter-bar";
import { getServerLocale, getTranslations } from "@/lib/i18n";
import { PerformancePanel } from "@/components/performance-panel";
import { WorkspaceShell } from "@/components/workspace-shell";

export const runtime = "nodejs";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function PerformancePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const locale = await getServerLocale();
  const t = getTranslations(locale);
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

  const [bookings, expenses, latestImport, userSettings, resolvedSearchParams] = await Promise.all([
    getBookings(ownerEmail),
    getExpenses(ownerEmail),
    getLatestImport(ownerEmail),
    getUserSettings(ownerEmail, userName),
    searchParams,
  ]);

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
    <WorkspaceShell
      activePage="performance"
      pageTitle={t("page.performance.title")}
      pageSubtitle={t("page.performance.subtitle")}
      businessName={userSettings.businessName}
      userName={userName}
      userEmail={ownerEmail}
      currencyCode={view.displayCurrencyCode}
      latestImport={latestImport}
      actions={
        <FilterBar
          channels={view.availableChannels}
          countries={view.availableCountries}
          selectedRangePreset={view.filters.rangePreset}
          selectedStartDate={view.filters.startDate}
          selectedEndDate={view.filters.endDate}
          selectedChannel={view.filters.channel}
          selectedCountryCode={view.filters.countryCode}
        />
      }
    >
      <PerformancePanel
        view={view}
        currencyCode={view.displayCurrencyCode}
        rangeLabel={view.rangeLabel}
      />
    </WorkspaceShell>
  );
}
