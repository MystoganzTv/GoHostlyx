import { requireDashboardAccess } from "@/lib/access";
import { redirect } from "next/navigation";
import { BookOpenText, CircleAlert, Home } from "lucide-react";
import { BookingsManager } from "@/components/bookings-manager";
import { FilterBar } from "@/components/filter-bar";
import { OperationalImportLauncher } from "@/components/operational-import-launcher";
import { SectionCard } from "@/components/section-card";
import { StatStrip } from "@/components/stat-strip";
import { WorkspaceShell } from "@/components/workspace-shell";
import { getAuthSession } from "@/lib/auth";
import {
  buildDashboardView,
  filterBookingsForFilters,
  getDashboardFilters,
} from "@/lib/dashboard";
import {
  getBookings,
  getExpenses,
  getFinancialDocuments,
  getLatestImport,
  getPropertyDefinitions,
  getUserSettings,
} from "@/lib/db";
import { formatNumber } from "@/lib/format";
import { getReconcileSidebarBadge } from "@/lib/reconcile";
import { getRequestLocale } from "@/lib/server-locale";

export const runtime = "nodejs";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function BookingsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const locale = await getRequestLocale();
  const isSpanish = locale === "es";
  const session = await getAuthSession();
  const ownerEmail = session?.user?.email?.toLowerCase();

  if (!session?.user?.email || !ownerEmail) {
    redirect("/login");
  }

  await requireDashboardAccess(ownerEmail);

  const userName = session.user.name ?? session.user.email ?? "Host";
  const properties = await getPropertyDefinitions(ownerEmail);

  if (properties.length === 0) {
    redirect("/dashboard/properties?setup=1");
  }

  const [bookings, expenses, financialDocuments, latestImport, userSettings, resolvedSearchParams] = await Promise.all([
    getBookings(ownerEmail),
    getExpenses(ownerEmail),
    getFinancialDocuments(ownerEmail),
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
    financialDocuments,
    filters,
    properties,
    fallbackCountryCode: userSettings.primaryCountryCode,
    taxCountryCode: userSettings.taxCountryCode,
    taxRate: userSettings.taxRate,
    locale,
  });
  const filteredBookings = filterBookingsForFilters({
    bookings,
    filters,
    properties,
    fallbackCountryCode: userSettings.primaryCountryCode,
  });
  const highlightedBookingKey =
    typeof resolvedSearchParams.booking === "string" ? resolvedSearchParams.booking : null;
  const initialReviewFilter =
    resolvedSearchParams.review === "needs-review"
      ? "needs-review"
      : resolvedSearchParams.review === "ready"
        ? "ready"
        : "all";

  const propertyCount = new Set(filteredBookings.map((booking) => booking.propertyName)).size;
  const reviewCount = filteredBookings.filter((booking) => booking.reviewStatus === "needs_review").length;

  return (
    <WorkspaceShell
      activePage="bookings"
      pageTitle={isSpanish ? "Reservas" : "Bookings"}
      pageSubtitle={
        isSpanish
          ? "Revisa estancias de huéspedes, payouts y asignaciones de propiedad o listing."
          : "Review guest stays, payouts, and property or listing assignments."
      }
      businessName={userSettings.businessName}
      userName={userName}
      userEmail={ownerEmail}
      currencyCode={view.displayCurrencyCode}
      latestImport={latestImport}
      reconcileBadge={getReconcileSidebarBadge(view.reconcile, view.displayCurrencyCode)}
      toolbar={
      <FilterBar
        channels={view.availableChannels}
        countries={view.availableCountries}
        rangeShortcutYears={view.availableYears}
        selectedRangePreset={view.filters.rangePreset}
        selectedStartDate={view.filters.startDate}
        selectedEndDate={view.filters.endDate}
        selectedChannel={view.filters.channel}
        selectedCountryCode={view.filters.countryCode}
      />
      }
      actions={
        <OperationalImportLauncher
          properties={properties}
          context="bookings"
          buttonClassName="workspace-button-primary inline-flex items-center justify-center gap-2 rounded-lg px-3.5 py-2 text-sm font-semibold transition"
        />
      }
    >
      <div className="space-y-6">
        <StatStrip
          items={[
            {
              label: isSpanish ? "Reservas en vista" : "Bookings in view",
              value: formatNumber(filteredBookings.length),
              icon: <BookOpenText className="h-4 w-4" />,
            },
            {
              label: isSpanish ? "Necesitan revisión" : "Need review",
              value: formatNumber(reviewCount),
              icon: <CircleAlert className="h-4 w-4" />,
            },
            {
              label: isSpanish ? "Propiedades en vista" : "Properties in view",
              value: formatNumber(propertyCount),
              icon: <Home className="h-4 w-4" />,
            },
          ]}
        />

        <SectionCard
          title={isSpanish ? "Todas las reservas" : "All Bookings"}
          subtitle={
            isSpanish
              ? "Usa los filtros de arriba para enfocar por mercado, rango de fechas y canal."
              : "Use the filters above to focus by market, date range, and channel."
          }
        >
          <BookingsManager
            bookings={filteredBookings}
            currencyCode={view.displayCurrencyCode}
            properties={properties}
            highlightedBookingKey={highlightedBookingKey}
            initialReviewFilter={initialReviewFilter}
          />
        </SectionCard>
      </div>
    </WorkspaceShell>
  );
}
