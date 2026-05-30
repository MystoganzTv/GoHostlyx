import { redirect } from "next/navigation";
import { ReceiptText, Wallet } from "lucide-react";
import { ExpensesManager } from "@/components/expenses-manager";
import { FilterBar } from "@/components/filter-bar";
import { OperationalImportLauncher } from "@/components/operational-import-launcher";
import { SectionCard } from "@/components/section-card";
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
    >
      <div className="space-y-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <SectionCard
            title={isSpanish ? "Entrada principal" : "Primary entry point"}
            subtitle={
              isSpanish
                ? "Si tu archivo es mayormente de gastos, empieza aquí. Import Center se queda como historial y control."
                : "If your file is mostly expenses, start here. Import Center stays as history and control."
            }
            className="max-w-xl"
            action={
              <OperationalImportLauncher
                properties={properties}
                context="expenses"
                buttonClassName="workspace-button-primary inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-semibold transition"
              />
            }
          >
            <p className="text-sm leading-6 text-[var(--workspace-muted)]">
              {isSpanish
                ? "Ideal para hojas de coste, extractos operativos y archivos mixtos donde los gastos son la prioridad."
                : "Best for cost sheets, operating extracts, and mixed workbooks where expenses are the priority."}
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
            showChannelSelect={false}
          />
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <SectionCard title={isSpanish ? "Gastos en vista" : "Expenses in view"}>
            <div className="flex items-center gap-3">
              <div className="workspace-icon-chip rounded-2xl p-3">
                <Wallet className="h-5 w-5" />
              </div>
              <p className="text-2xl font-semibold text-[var(--workspace-text)]">
                {formatCurrency(totalExpenses, false, view.displayCurrencyCode)}
              </p>
            </div>
          </SectionCard>
          <SectionCard title={isSpanish ? "Filas de gasto" : "Expense rows"}>
            <div className="flex items-center gap-3">
              <div className="workspace-icon-chip rounded-2xl p-3">
                <ReceiptText className="h-5 w-5" />
              </div>
              <p className="text-2xl font-semibold text-[var(--workspace-text)]">
                {formatNumber(filteredExpenses.length)}
              </p>
            </div>
          </SectionCard>
          <SectionCard title={isSpanish ? "Edición" : "Editing"}>
            <p className="text-sm leading-6 text-[var(--workspace-muted)]">
              {isSpanish
                ? "Reclasifica categorías, mueve gastos a la propiedad correcta y limpia notas directamente dentro de la app."
                : "Reclassify categories, move expenses to the right property, and clean notes directly inside the app."}
            </p>
          </SectionCard>
        </div>

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
