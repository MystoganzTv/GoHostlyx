import { redirect } from "next/navigation";
import { FileSpreadsheet, Layers3 } from "lucide-react";
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
import { getServerLocale, getTranslations } from "@/lib/i18n";

export const runtime = "nodejs";

export default async function ImportsPage() {
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

  return (
    <WorkspaceShell
      activePage="imports"
      pageTitle={t("page.imports.title")}
      pageSubtitle={t("page.imports.subtitle")}
      businessName={userSettings.businessName}
      userName={userName}
      userEmail={ownerEmail}
      currencyCode={userSettings.currencyCode}
      latestImport={latestImport}
    >
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-3">
          <SectionCard title="Imported files">
            <div className="flex items-center gap-3">
              <div className="workspace-icon-chip rounded-2xl p-3">
                <FileSpreadsheet className="h-5 w-5" />
              </div>
              <p className="text-2xl font-semibold text-[var(--workspace-text)]">
                {formatNumber(importSummaries.length)}
              </p>
            </div>
          </SectionCard>

          <SectionCard title="Records now in Hostlyx">
            <div className="flex items-center gap-3">
              <div className="workspace-icon-chip rounded-2xl p-3">
                <Layers3 className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-semibold text-[var(--workspace-text)]">
                  {formatNumber(totalImportedBookings + totalImportedExpenses)}
                </p>
                <p className="mt-1 text-xs text-[var(--workspace-muted)]">
                  {formatNumber(totalImportedBookings)} bookings and {formatNumber(totalImportedExpenses)} expenses
                </p>
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Properties touched">
            <div className="flex items-center gap-3">
              <div className="workspace-icon-chip rounded-2xl p-3">
                <Layers3 className="h-5 w-5" />
              </div>
              <p className="text-2xl font-semibold text-[var(--workspace-text)]">
                {formatNumber(new Set(importSummaries.map((entry) => entry.propertyName)).size)}
              </p>
            </div>
          </SectionCard>
        </div>

        <SectionCard title="How to think about it">
          <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
            <p className="text-sm leading-6 text-[var(--workspace-muted)]">
              Use this page as audit trail and backup history. Once a workbook is imported, you should think of the records as app data, not as something still owned by the spreadsheet.
            </p>
            <div className="workspace-soft-card rounded-[22px] px-4 py-4 text-sm leading-6 text-[var(--workspace-muted)]">
              Import is a secondary workflow in Hostlyx. Day to day, your source of truth should be the bookings, expenses, properties, and edits that live inside the app.
            </div>
          </div>
        </SectionCard>

        <SectionCard
          title="Backup & Audit Trail"
          subtitle="Each batch below shows which property it entered, when it landed, and how many live records it created inside Hostlyx."
        >
          <ImportsManager importSummaries={importSummaries} />
        </SectionCard>
      </div>
    </WorkspaceShell>
  );
}
