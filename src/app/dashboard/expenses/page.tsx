import { requireDashboardAccess } from "@/lib/access";
import { redirect } from "next/navigation";
import { Home, ReceiptText, Wallet } from "lucide-react";
import { ExpensesManager } from "@/components/expenses-manager";
import { FilterBar } from "@/components/filter-bar";
import { OperationalImportLauncher } from "@/components/operational-import-launcher";
import { SectionCard } from "@/components/section-card";
import { StatStrip } from "@/components/stat-strip";
import { WorkspaceShell } from "@/components/workspace-shell";
import { getAuthSession } from "@/lib/auth";
import {
  buildDashboardView,
  filterExpensesForFilters,
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
import { formatCurrency, formatNumber } from "@/lib/format";
import { getReconcileSidebarBadge } from "@/lib/reconcile";
import { getRequestLocale } from "@/lib/server-locale";

export const runtime = "nodejs";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function ExpensesPage({
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
  const filteredExpenses = filterExpensesForFilters({
    expenses,
    filters,
    properties,
    fallbackCountryCode: userSettings.primaryCountryCode,
  });

  const totalExpenses = filteredExpenses.reduce((sum, expense) => sum + expense.amount, 0);
  const propertyCount = new Set(
    filteredExpenses.map((expense) => expense.propertyName).filter(Boolean),
  ).size;

  return (
    <WorkspaceShell
      activePage="expenses"
      pageTitle={isSpanish ? "Gastos" : "Expenses"}
      pageSubtitle={
        isSpanish
          ? "Sigue costes operativos, categorías y gasto por propiedad o listing."
          : "Track operating costs, categories, and spend by property or listing."
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
        showChannelSelect={false}
      />
      }
      actions={
        <OperationalImportLauncher
          properties={properties}
          context="expenses"
          buttonClassName="workspace-button-primary inline-flex items-center justify-center gap-2 rounded-lg px-3.5 py-2 text-sm font-semibold transition"
        />
      }
    >
      <div className="space-y-6">
        <StatStrip
          items={[
            {
              label: isSpanish ? "Gastos en vista" : "Expenses in view",
              value: formatCurrency(totalExpenses, false, view.displayCurrencyCode),
              icon: <Wallet className="h-4 w-4" />,
            },
            {
              label: isSpanish ? "Filas de gasto" : "Expense rows",
              value: formatNumber(filteredExpenses.length),
              icon: <ReceiptText className="h-4 w-4" />,
            },
            {
              label: isSpanish ? "Propiedades con gasto" : "Properties with spend",
              value: formatNumber(propertyCount),
              icon: <Home className="h-4 w-4" />,
            },
          ]}
        />

        <SectionCard
          title={isSpanish ? "Todos los gastos" : "All Expenses"}
          subtitle={
            isSpanish
              ? "Usa los filtros de arriba para enfocar por mercado y rango de fechas."
              : "Use the filters above to focus by market and date range."
          }
        >
          <ExpensesManager
            expenses={filteredExpenses}
            currencyCode={view.displayCurrencyCode}
            properties={properties}
          />
        </SectionCard>
      </div>
    </WorkspaceShell>
  );
}
