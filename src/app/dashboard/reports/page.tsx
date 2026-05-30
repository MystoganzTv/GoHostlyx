import { redirect } from "next/navigation";
import { buildDashboardView, getDashboardFilters } from "@/lib/dashboard";
import { getAuthSession } from "@/lib/auth";
import {
  getBookings,
  getExpenses,
  getFinancialDocuments,
  getLatestImport,
  getPropertyDefinitions,
  getSubscriptionState,
  getUserSettings,
} from "@/lib/db";
import { FilterBar } from "@/components/filter-bar";
import { ExportReportLink } from "@/components/export-report-link";
import { SectionCard } from "@/components/section-card";
import { SubscriptionUpgradeCard } from "@/components/subscription-upgrade-card";
import { WorkspaceShell } from "@/components/workspace-shell";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/format";
import { getReconcileSidebarBadge } from "@/lib/reconcile";
import { getRequestLocale } from "@/lib/server-locale";
import { canAccessReports, getSubscriptionBadge } from "@/lib/subscription";

export const runtime = "nodejs";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function ReportsPage({
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

  const [bookings, expenses, financialDocuments, latestImport, userSettings, resolvedSearchParams, subscription] = await Promise.all([
    getBookings(ownerEmail),
    getExpenses(ownerEmail),
    getFinancialDocuments(ownerEmail),
    getLatestImport(ownerEmail),
    getUserSettings(ownerEmail, userName),
    searchParams,
    getSubscriptionState(ownerEmail),
  ]);
  const subscriptionBadge = getSubscriptionBadge(subscription);

  if (!canAccessReports(subscription)) {
    return (
      <WorkspaceShell
        activePage="reports"
        pageTitle={isSpanish ? "Reportes" : "Reports"}
        pageSubtitle={
          isSpanish
            ? "El reporte mensual y la mezcla por canales están disponibles en Pro y Portfolio."
            : "Monthly reporting and channel mix are available on Pro and Portfolio."
        }
        businessName={userSettings.businessName}
        userName={userName}
        userEmail={ownerEmail}
        currencyCode={userSettings.currencyCode}
        latestImport={latestImport}
        subscriptionBadge={subscriptionBadge}
      >
        <SubscriptionUpgradeCard
          title={isSpanish ? "Sube de plan para desbloquear reportes" : "Upgrade to unlock reports"}
          description={
            isSpanish
              ? "Los reportes forman parte del plan Pro en adelante. Tus datos importados siguen seguros y puedes mejorar el plan cuando quieras."
              : "Reports are part of the Pro plan and above. Your imported data stays safe, and you can upgrade whenever you are ready."
          }
        />
      </WorkspaceShell>
    );
  }

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

  return (
    <WorkspaceShell
      activePage="reports"
      pageTitle={isSpanish ? "Reportes" : "Reports"}
      pageSubtitle={
        isSpanish
          ? "Reporte mensual, mezcla por canales y estructura de costes para la vista actual del negocio."
          : "Monthly reporting, channel mix, and cost structure for the current business view."
      }
      businessName={userSettings.businessName}
      userName={userName}
      userEmail={ownerEmail}
      currencyCode={view.displayCurrencyCode}
      latestImport={latestImport}
      reconcileBadge={getReconcileSidebarBadge(view.reconcile, view.displayCurrencyCode)}
      subscriptionBadge={subscriptionBadge}
      actions={
        <div className="flex flex-col gap-3 xl:items-end">
          <div className="rounded-[28px] border border-[var(--workspace-border)] bg-[var(--workspace-panel)] p-3 shadow-[0_12px_28px_rgba(15,23,42,0.04)]">
            <FilterBar
              channels={view.availableChannels}
              countries={view.availableCountries}
              rangeShortcutYears={view.availableYears}
              selectedRangePreset={view.filters.rangePreset}
              selectedStartDate={view.filters.startDate}
              selectedEndDate={view.filters.endDate}
              selectedChannel={view.filters.channel}
              selectedCountryCode={view.filters.countryCode}
              embedded
            />
          </div>
          <ExportReportLink
            className="h-[72px] rounded-[28px] border border-[var(--workspace-accent)]/32 bg-[linear-gradient(180deg,rgba(31,83,93,0.92)_0%,rgba(22,65,74,0.92)_100%)] px-7 text-[15px] font-semibold text-slate-100 shadow-[0_18px_34px_rgba(6,20,35,0.22),inset_0_1px_0_rgba(255,255,255,0.06)] transition hover:border-[var(--workspace-accent)]/46 hover:bg-[linear-gradient(180deg,rgba(37,94,104,0.94)_0%,rgba(26,72,82,0.94)_100%)]"
          />
        </div>
      }
    >
      <div className="space-y-6">
        <SectionCard
          title={isSpanish ? "Rendimiento mensual" : "Monthly Performance"}
          subtitle={
            isSpanish
              ? "Ingresos, gastos y beneficio agrupados mes a mes."
              : "Revenue, expenses, and profit grouped month by month."
          }
        >
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-[0.18em] text-[var(--workspace-muted)]">
                <tr>
                  <th className="pb-3 pr-4 font-medium">{isSpanish ? "Mes" : "Month"}</th>
                  <th className="pb-3 pr-4 font-medium">{isSpanish ? "Reservas" : "Bookings"}</th>
                  <th className="pb-3 pr-4 font-medium">{isSpanish ? "Ingresos" : "Revenue"}</th>
                  <th className="pb-3 pr-4 font-medium">{isSpanish ? "Gastos" : "Expenses"}</th>
                  <th className="pb-3 pr-4 font-medium">{isSpanish ? "Beneficio" : "Profit"}</th>
                  <th className="pb-3 font-medium">{isSpanish ? "Margen" : "Margin"}</th>
                </tr>
              </thead>
              <tbody>
                {view.monthlySummary.map((month, index) => {
                  const margin = month.revenue > 0 ? month.profit / month.revenue : 0;

                  return (
                    <tr
                      key={`${month.label}-${index}`}
                      className="border-t border-[var(--workspace-border)] text-[var(--workspace-text)]"
                    >
                      <td className="py-4 pr-4 font-medium">{month.label}</td>
                      <td className="py-4 pr-4">{formatNumber(month.bookings, locale)}</td>
                      <td className="py-4 pr-4">{formatCurrency(month.revenue, false, view.displayCurrencyCode, locale)}</td>
                      <td className="py-4 pr-4">{formatCurrency(month.expenses, false, view.displayCurrencyCode, locale)}</td>
                      <td className={`py-4 pr-4 ${month.profit >= 0 ? "text-emerald-300" : "text-rose-200"}`}>
                        {formatCurrency(month.profit, false, view.displayCurrencyCode, locale)}
                      </td>
                      <td className="py-4">{formatPercent(margin, locale)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </SectionCard>

        <div className="grid gap-6 xl:grid-cols-2">
          <SectionCard
            title={isSpanish ? "Ingresos por canal" : "Revenue by Channel"}
            subtitle={
              isSpanish
                ? "Qué plataformas están moviendo realmente el negocio."
                : "Which platforms are actually driving the business."
            }
          >
            <div className="space-y-3">
              {view.revenueByChannel.map((channel) => (
                <div key={channel.label} className="workspace-soft-card rounded-[22px] p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-semibold text-[var(--workspace-text)]">{channel.label}</p>
                      <p className="mt-1 text-sm text-[var(--workspace-muted)]">
                        {formatNumber(channel.bookings, locale)} {isSpanish ? "reservas" : "bookings"}
                      </p>
                    </div>
                    <span className="text-sm font-semibold text-[var(--workspace-text)]">
                      {formatCurrency(channel.revenue, false, view.displayCurrencyCode, locale)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>

          <SectionCard
            title={isSpanish ? "Estructura de costes" : "Cost Structure"}
            subtitle={
              isSpanish
                ? "Las categorías que se están llevando la mayor parte de los gastos."
                : "The categories taking the largest share of expenses."
            }
          >
            <div className="space-y-3">
              {view.expensesByCategory.map((item) => {
                const totalExpenses = view.expensesByCategory.reduce((sum, current) => sum + current.value, 0);
                const share = totalExpenses > 0 ? item.value / totalExpenses : 0;

                return (
                  <div key={item.label} className="workspace-soft-card rounded-[22px] p-4">
                    <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-semibold text-[var(--workspace-text)]">{item.label}</p>
                      <p className="mt-1 text-sm text-[var(--workspace-muted)]">
                        {formatPercent(share, locale)} {isSpanish ? "del gasto total" : "of total expenses"}
                      </p>
                    </div>
                    <span className="text-sm font-semibold text-[var(--workspace-text)]">
                      {formatCurrency(item.value, false, view.displayCurrencyCode, locale)}
                    </span>
                  </div>
                </div>
                );
              })}
            </div>
          </SectionCard>
        </div>
      </div>
    </WorkspaceShell>
  );
}
