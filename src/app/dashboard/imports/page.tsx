import { requireDashboardAccess } from "@/lib/access";
import { redirect } from "next/navigation";
import { FileSpreadsheet, Layers3 } from "lucide-react";
import { ImportCenterLauncher } from "@/components/import-center-launcher";
import { ImportsManager } from "@/components/imports-manager";
import { SectionCard } from "@/components/section-card";
import { StatStrip } from "@/components/stat-strip";
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

  await requireDashboardAccess(ownerEmail);

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
          ? "Historial de todo lo importado: Airbnb, Booking.com, Excel de GoHostlyx y extractos de payout."
          : "History of everything imported: Airbnb, Booking.com, GoHostlyx Excel and payout statements."
      }
      businessName={userSettings.businessName}
      userName={userName}
      userEmail={ownerEmail}
      currencyCode={userSettings.currencyCode}
      latestImport={latestImport}
      actions={<ImportCenterLauncher properties={properties} />}
    >
      <div className="space-y-6">
        <StatStrip
          items={[
            {
              label: isSpanish ? "Archivos importados" : "Imported files",
              value: formatNumber(importSummaries.length, locale),
              icon: <FileSpreadsheet className="h-4 w-4" />,
            },
            {
              label: isSpanish ? "Registros importados" : "Imported records",
              value: formatNumber(totalImportedBookings + totalImportedExpenses, locale),
              hint: isSpanish
                ? `${formatNumber(totalImportedBookings, locale)} reservas y ${formatNumber(totalImportedExpenses, locale)} gastos`
                : `${formatNumber(totalImportedBookings, locale)} bookings and ${formatNumber(totalImportedExpenses, locale)} expenses`,
              icon: <Layers3 className="h-4 w-4" />,
            },
            {
              label: isSpanish ? "Extractos de payout" : "Payout statements",
              value: formatNumber(totalPayoutStatements, locale),
              icon: <Layers3 className="h-4 w-4" />,
            },
          ]}
        />

        <SectionCard
          title={isSpanish ? "Historial de importaciones" : "Import history"}
          subtitle={
            isSpanish
              ? "Qué archivo entró, en qué propiedad y cuándo. Borrar una importación quita solo los datos que trajo."
              : "Which file landed, in which property and when. Deleting an import removes only the data it brought in."
          }
        >
          <ImportsManager importSummaries={importSummaries} />
        </SectionCard>
      </div>
    </WorkspaceShell>
  );
}
