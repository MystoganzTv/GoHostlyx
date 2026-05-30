import { redirect } from "next/navigation";
import Link from "next/link";
import { FileSpreadsheet, Layers3 } from "lucide-react";
import { ImportCenterLauncher } from "@/components/import-center-launcher";
import { ImportsManager } from "@/components/imports-manager";
import { SectionCard } from "@/components/section-card";
import { WorkspaceShell } from "@/components/workspace-shell";
import { getAuthSession } from "@/lib/auth";
import {
  getImportSummaries,
  getLatestImport,
  getPropertyDefinitions,
  getUserSettings,
} from "@/lib/db";
import { formatNumber } from "@/lib/format";
import { getRequestLocale } from "@/lib/server-locale";

export const runtime = "nodejs";

export default async function ImportsPage() {
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

  const [importSummaries, latestImport, userSettings] = await Promise.all([
    getImportSummaries(ownerEmail),
    getLatestImport(ownerEmail),
    getUserSettings(ownerEmail, userName),
  ]);
  const totalImportedBookings = importSummaries.reduce(
    (sum, entry) => sum + entry.bookingsCount,
    0,
  );
  const totalImportedExpenses = importSummaries.reduce(
    (sum, entry) => sum + entry.expensesCount,
    0,
  );
  const totalPayoutStatements = importSummaries.filter(
    (entry) => entry.importedSource === "financial_statement",
  ).length;

  return (
    <WorkspaceShell
      activePage="imports"
      pageTitle={isSpanish ? "Centro de importación" : "Import Center"}
      pageSubtitle={
        isSpanish
          ? "Usa Reservas o Gastos como punto de entrada principal. Esta página queda para historial, control y trazabilidad."
          : "Use Bookings or Expenses as the main entry point. This page stays focused on history, control, and traceability."
      }
      businessName={userSettings.businessName}
      userName={userName}
      userEmail={ownerEmail}
      currencyCode={userSettings.currencyCode}
      latestImport={latestImport}
    >
      <div className="space-y-6">
        <ImportCenterLauncher properties={properties} />

        <div className="grid gap-4 md:grid-cols-3">
          <SectionCard title={isSpanish ? "Archivos importados" : "Imported files"}>
            <div className="flex items-center gap-3">
              <div className="workspace-icon-chip rounded-2xl p-3">
                <FileSpreadsheet className="h-5 w-5" />
              </div>
              <p className="text-2xl font-semibold text-[var(--workspace-text)]">
                {formatNumber(importSummaries.length)}
              </p>
            </div>
          </SectionCard>

          <SectionCard title={isSpanish ? "Registros operativos" : "Operational records"}>
            <div className="flex items-center gap-3">
              <div className="workspace-icon-chip rounded-2xl p-3">
                <Layers3 className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-semibold text-[var(--workspace-text)]">
                  {formatNumber(totalImportedBookings + totalImportedExpenses)}
                </p>
                <p className="mt-1 text-xs text-[var(--workspace-muted)]">
                  {formatNumber(totalImportedBookings, locale)} {isSpanish ? "reservas" : "bookings"} {isSpanish ? "y" : "and"} {formatNumber(totalImportedExpenses, locale)} {isSpanish ? "gastos" : "expenses"}
                </p>
              </div>
            </div>
          </SectionCard>

          <SectionCard title={isSpanish ? "Statements de payout" : "Payout statements"}>
            <div className="flex items-center gap-3">
              <div className="workspace-icon-chip rounded-2xl p-3">
                <Layers3 className="h-5 w-5" />
              </div>
              <p className="text-2xl font-semibold text-[var(--workspace-text)]">
                {formatNumber(totalPayoutStatements, locale)}
              </p>
            </div>
          </SectionCard>
        </div>

        <SectionCard title={isSpanish ? "Cómo pensarlo" : "How to think about it"}>
          <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
            <p className="text-sm leading-6 text-[var(--workspace-muted)]">
              {isSpanish
                ? "Piensa en esta página como la capa de control. Las reservas viven mejor en Reservas, los gastos en Gastos y los payout statements en Liquidaciones. Aquí revisas qué cayó y cuándo."
                : "Think of this page as the control layer. Bookings belong naturally in Bookings, expenses in Expenses, and payout statements in Payouts. This is where you review what landed and when."}
            </p>
            <div className="workspace-soft-card rounded-[22px] px-4 py-4 text-sm leading-6 text-[var(--workspace-muted)]">
              <p>
                {isSpanish
                  ? "Cada archivo de abajo sigue visible como historial de importación para que entiendas qué cambió, cuándo cayó y si creó reservas, gastos o un statement de payout."
                  : "Each file below stays visible as import history so you can understand what changed, when it landed, and whether it created bookings, expenses, or a payout statement."}
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <Link
                  href="/dashboard/bookings"
                  className="workspace-button-secondary inline-flex items-center justify-center rounded-2xl px-4 py-2.5 text-sm font-semibold transition"
                >
                  {isSpanish ? "Ir a Reservas" : "Go to Bookings"}
                </Link>
                <Link
                  href="/dashboard/expenses"
                  className="workspace-button-secondary inline-flex items-center justify-center rounded-2xl px-4 py-2.5 text-sm font-semibold transition"
                >
                  {isSpanish ? "Ir a Gastos" : "Go to Expenses"}
                </Link>
                <Link
                  href="/dashboard/payouts"
                  className="workspace-button-secondary inline-flex items-center justify-center rounded-2xl px-4 py-2.5 text-sm font-semibold transition"
                >
                  {isSpanish ? "Ir a Liquidaciones" : "Go to Payouts"}
                </Link>
              </div>
            </div>
          </div>
        </SectionCard>

        <SectionCard
          title={isSpanish ? "Backup y rastro de auditoría" : "Backup & Audit Trail"}
          subtitle={
            isSpanish
              ? "Cada batch de abajo muestra en qué propiedad entró, cuándo cayó y qué tipo de capa de datos añadió dentro de Hostlyx."
              : "Each batch below shows which property it entered, when it landed, and which data layer it added inside Hostlyx."
          }
        >
          <ImportsManager importSummaries={importSummaries} />
        </SectionCard>
      </div>
    </WorkspaceShell>
  );
}
