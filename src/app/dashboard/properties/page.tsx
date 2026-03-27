import { redirect } from "next/navigation";
import { Building2, Layers3 } from "lucide-react";
import { PropertiesManager } from "@/components/properties-manager";
import { SectionCard } from "@/components/section-card";
import { WorkspaceShell } from "@/components/workspace-shell";
import { getAuthSession } from "@/lib/auth";
import {
  getBookings,
  getExpenses,
  getImportSummaries,
  getLatestImport,
  getPropertyDefinitions,
  getUserSettings,
} from "@/lib/db";
import { formatNumber } from "@/lib/format";
import { getServerLocale, getTranslations } from "@/lib/i18n";

export const runtime = "nodejs";

export default async function PropertiesPage() {
  const locale = await getServerLocale();
  const t = getTranslations(locale);
  const session = await getAuthSession();
  const ownerEmail = session?.user?.email?.toLowerCase();

  if (!session?.user?.email || !ownerEmail) {
    redirect("/login");
  }

  const userName = session.user.name ?? session.user.email ?? "Host";
  const [bookings, expenses, importSummaries, latestImport, userSettings, propertyDefinitions] = await Promise.all([
    getBookings(ownerEmail),
    getExpenses(ownerEmail),
    getImportSummaries(ownerEmail),
    getLatestImport(ownerEmail),
    getUserSettings(ownerEmail, userName),
    getPropertyDefinitions(ownerEmail),
  ]);

  const propertyMap = new Map<
    string,
    {
      units: Set<string>;
      bookings: number;
      expenses: number;
      revenue: number;
      payout: number;
      importsCount: number;
      lastImportFileName: string;
    }
  >();

  for (const booking of bookings) {
    const current = propertyMap.get(booking.propertyName) ?? {
      units: new Set<string>(),
      bookings: 0,
      expenses: 0,
      revenue: 0,
      payout: 0,
      importsCount: 0,
      lastImportFileName: "",
    };

    if (booking.unitName) {
      current.units.add(booking.unitName);
    }

    current.bookings += 1;
    current.revenue += booking.totalRevenue;
    current.payout += booking.payout;
    propertyMap.set(booking.propertyName, current);
  }

  for (const expense of expenses) {
    const current = propertyMap.get(expense.propertyName) ?? {
      units: new Set<string>(),
      bookings: 0,
      expenses: 0,
      revenue: 0,
      payout: 0,
      importsCount: 0,
      lastImportFileName: "",
    };

    if (expense.unitName) {
      current.units.add(expense.unitName);
    }

    current.expenses += expense.amount;
    propertyMap.set(expense.propertyName, current);
  }

  for (const importSummary of importSummaries) {
    const current = propertyMap.get(importSummary.propertyName) ?? {
      units: new Set<string>(),
      bookings: 0,
      expenses: 0,
      revenue: 0,
      payout: 0,
      importsCount: 0,
      lastImportFileName: "",
    };

    current.importsCount += 1;
    if (!current.lastImportFileName) {
      current.lastImportFileName = importSummary.fileName;
    }
    propertyMap.set(importSummary.propertyName, current);
  }

  const properties = Array.from(propertyMap.entries()).map(([name, value]) => ({
    name,
    countryCode:
      propertyDefinitions.find((propertyDefinition) => propertyDefinition.name === name)?.countryCode ??
      userSettings.primaryCountryCode,
    units: Array.from(value.units).sort((left, right) => left.localeCompare(right)),
    bookings: value.bookings,
    revenue: value.revenue,
    payout: value.payout,
    expenses: value.expenses,
    profit: value.payout - value.expenses,
    importsCount: value.importsCount,
    lastImportFileName: value.lastImportFileName,
  }));

  for (const propertyDefinition of propertyDefinitions) {
    if (!propertyMap.has(propertyDefinition.name)) {
      properties.push({
        name: propertyDefinition.name,
        countryCode: propertyDefinition.countryCode,
        units: propertyDefinition.units.map((unit) => unit.name),
        bookings: 0,
        revenue: 0,
        payout: 0,
        expenses: 0,
        profit: 0,
        importsCount: 0,
        lastImportFileName: "",
      });
    }
  }

  properties.sort((left, right) => left.name.localeCompare(right.name));
  const isSetupMode = propertyDefinitions.length === 0;

  return (
    <WorkspaceShell
      activePage="properties"
      pageTitle={t("page.properties.title")}
      pageSubtitle={
        isSetupMode
          ? t("page.properties.setupSubtitle")
          : t("page.properties.subtitle")
      }
      businessName={userSettings.businessName}
      userName={userName}
      userEmail={ownerEmail}
      currencyCode={userSettings.currencyCode}
      latestImport={latestImport}
    >
      <div className="space-y-6">
        {isSetupMode ? (
          <SectionCard
            title="Start With Your First Property"
            subtitle="Hostlyx opens the setup modal automatically because every booking, expense, and import must belong to a real property first."
          >
            <div className="grid gap-4 lg:grid-cols-3">
              <div className="workspace-soft-card rounded-[24px] p-4">
                <p className="text-sm font-semibold text-[var(--workspace-text)]">Single house</p>
                <p className="mt-2 text-sm leading-6 text-[var(--workspace-muted)]">
                  Choose this when you rent the full home as one listing. No units are required.
                </p>
              </div>
              <div className="workspace-soft-card rounded-[24px] p-4">
                <p className="text-sm font-semibold text-[var(--workspace-text)]">Multi-unit property</p>
                <p className="mt-2 text-sm leading-6 text-[var(--workspace-muted)]">
                  Tell Hostlyx how many units you have, and we will create them automatically for you.
                </p>
              </div>
              <div className="workspace-soft-card rounded-[24px] p-4">
                <p className="text-sm font-semibold text-[var(--workspace-text)]">What unlocks next</p>
                <p className="mt-2 text-sm leading-6 text-[var(--workspace-muted)]">
                  Once the first property exists, dashboard, imports, bookings, and expenses become available.
                </p>
              </div>
            </div>
          </SectionCard>
        ) : null}

        <div className="grid gap-4 md:grid-cols-3">
          <SectionCard title="Properties">
            <div className="flex items-center gap-3">
              <div className="workspace-icon-chip rounded-2xl p-3">
                <Building2 className="h-5 w-5" />
              </div>
              <p className="text-2xl font-semibold text-[var(--workspace-text)]">
                {formatNumber(properties.length)}
              </p>
            </div>
          </SectionCard>
          <SectionCard title="Units">
            <div className="flex items-center gap-3">
              <div className="workspace-icon-chip rounded-2xl p-3">
                <Layers3 className="h-5 w-5" />
              </div>
              <p className="text-2xl font-semibold text-[var(--workspace-text)]">
                {formatNumber(properties.reduce((sum, property) => sum + property.units.length, 0))}
              </p>
            </div>
          </SectionCard>
          <SectionCard title="How to use it">
            <p className="text-sm leading-6 text-[var(--workspace-muted)]">
              Imports are assigned to the property you choose during upload. Each property also keeps its own market, so USA, Spain, and UK reporting can live in the same Hostlyx account.
            </p>
          </SectionCard>
        </div>

        <SectionCard
          title={isSetupMode ? "Create Your First Property" : "Property Setup"}
          subtitle={
            isSetupMode
              ? "Tell Hostlyx whether this is a single-home rental or a building with several units."
              : "Create the portfolio structure first, then assign bookings and expenses to the right property and unit."
          }
        >
          <PropertiesManager
            properties={propertyDefinitions}
            summaries={properties}
            forceCreateOnEmpty={isSetupMode}
            defaultCountryCode={userSettings.primaryCountryCode}
          />
        </SectionCard>
      </div>
    </WorkspaceShell>
  );
}
