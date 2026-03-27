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
import { SectionCard } from "@/components/section-card";
import { WorkspaceShell } from "@/components/workspace-shell";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/format";
import { getServerLocale, getTranslations } from "@/lib/i18n";

export const runtime = "nodejs";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function ReportsPage({
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
      activePage="reports"
      pageTitle={t("page.reports.title")}
      pageSubtitle={t("page.reports.subtitle")}
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
      <div className="space-y-6">
        <SectionCard
          title="Monthly Performance"
          subtitle="Revenue, expenses, and profit grouped month by month."
        >
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-[0.18em] text-[var(--workspace-muted)]">
                <tr>
                  <th className="pb-3 pr-4 font-medium">Month</th>
                  <th className="pb-3 pr-4 font-medium">Bookings</th>
                  <th className="pb-3 pr-4 font-medium">Revenue</th>
                  <th className="pb-3 pr-4 font-medium">Expenses</th>
                  <th className="pb-3 pr-4 font-medium">Profit</th>
                  <th className="pb-3 font-medium">Margin</th>
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
                      <td className="py-4 pr-4">{formatNumber(month.bookings)}</td>
                      <td className="py-4 pr-4">{formatCurrency(month.revenue, false, view.displayCurrencyCode)}</td>
                      <td className="py-4 pr-4">{formatCurrency(month.expenses, false, view.displayCurrencyCode)}</td>
                      <td className={`py-4 pr-4 ${month.profit >= 0 ? "text-emerald-300" : "text-rose-200"}`}>
                        {formatCurrency(month.profit, false, view.displayCurrencyCode)}
                      </td>
                      <td className="py-4">{formatPercent(margin)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </SectionCard>

        <div className="grid gap-6 xl:grid-cols-2">
          <SectionCard
            title="Revenue by Channel"
            subtitle="Which platforms are actually driving the business."
          >
            <div className="space-y-3">
              {view.revenueByChannel.map((channel) => (
                <div key={channel.label} className="workspace-soft-card rounded-[22px] p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-semibold text-[var(--workspace-text)]">{channel.label}</p>
                      <p className="mt-1 text-sm text-[var(--workspace-muted)]">
                        {formatNumber(channel.bookings)} bookings
                      </p>
                    </div>
                    <span className="text-sm font-semibold text-[var(--workspace-text)]">
                      {formatCurrency(channel.revenue, false, view.displayCurrencyCode)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>

          <SectionCard
            title="Cost Structure"
            subtitle="The categories taking the largest share of expenses."
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
                        <p className="mt-1 text-sm text-[var(--workspace-muted)]">{formatPercent(share)} of total expenses</p>
                      </div>
                      <span className="text-sm font-semibold text-[var(--workspace-text)]">
                        {formatCurrency(item.value, false, view.displayCurrencyCode)}
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
