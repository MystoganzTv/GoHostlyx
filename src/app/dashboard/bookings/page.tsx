import { redirect } from "next/navigation";
import { BookOpenText, Home } from "lucide-react";
import { BookingsManager } from "@/components/bookings-manager";
import { FilterBar } from "@/components/filter-bar";
import { OperationalImportLauncher } from "@/components/operational-import-launcher";
import { SectionCard } from "@/components/section-card";
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
    >
      <div className="space-y-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <SectionCard
            title={isSpanish ? "Entrada principal" : "Primary entry point"}
            subtitle={
              isSpanish
                ? "Si tu archivo es mayormente de reservas, empieza aquí. Import Center se queda como historial y control."
                : "If your file is mostly bookings, start here. Import Center stays as history and control."
            }
            className="max-w-xl"
            action={
              <OperationalImportLauncher
                properties={properties}
                context="bookings"
                buttonClassName="workspace-button-primary inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-semibold transition"
              />
            }
          >
            <p className="text-sm leading-6 text-[var(--workspace-muted)]">
              {isSpanish
                ? "Ideal para exports de Airbnb o Booking.com con huéspedes, fechas, nights y payout por estancia."
                : "Best for Airbnb or Booking.com exports with guests, dates, nights, and payout per stay."}
            </p>
          </SectionCard>
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
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <SectionCard title={isSpanish ? "Reservas en vista" : "Bookings in view"}>
            <div className="flex items-center gap-3">
              <div className="workspace-icon-chip rounded-2xl p-3">
                <BookOpenText className="h-5 w-5" />
              </div>
              <p className="text-2xl font-semibold text-[var(--workspace-text)]">
                {formatNumber(filteredBookings.length)}
              </p>
            </div>
          </SectionCard>
          <SectionCard title={isSpanish ? "Necesitan revisión" : "Need review"}>
            <div className="flex items-center gap-3">
              <div className="workspace-icon-chip rounded-2xl p-3">
                <BookOpenText className="h-5 w-5" />
              </div>
              <p className="text-2xl font-semibold text-[var(--workspace-text)]">
                {formatNumber(reviewCount)}
              </p>
            </div>
          </SectionCard>
          <SectionCard title={isSpanish ? "Propiedades en vista" : "Properties in view"}>
            <div className="flex items-center gap-3">
              <div className="workspace-icon-chip rounded-2xl p-3">
                <Home className="h-5 w-5" />
              </div>
              <p className="text-2xl font-semibold text-[var(--workspace-text)]">
                {formatNumber(propertyCount)}
              </p>
            </div>
          </SectionCard>
        </div>

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
