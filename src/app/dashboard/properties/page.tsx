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
import { getRequestLocale } from "@/lib/server-locale";

export const runtime = "nodejs";

export default async function PropertiesPage() {
  const locale = await getRequestLocale();
  const isSpanish = locale === "es";
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
      pageTitle={isSpanish ? "Listings" : "Listings"}
      pageSubtitle={
        isSetupMode
          ? isSpanish
            ? "Completa tu primera configuración de propiedad y listing antes de cualquier otra cosa en Hostlyx."
            : "Complete your first property and listing setup before anything else in Hostlyx."
          : isSpanish
            ? "Organiza la cartera en propiedades y los listings que pertenecen a cada una."
            : "Organize the portfolio into properties and the listings that belong to them."
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
            title={isSpanish ? "Empieza con tu primer setup de listing" : "Start With Your First Listing Setup"}
            subtitle={
              isSpanish
                ? "Hostlyx abre el modal de setup automáticamente porque cada reserva, gasto, sync de calendario e importación debe pertenecer primero a una estructura real de propiedad y listing."
                : "Hostlyx opens the setup modal automatically because every booking, expense, calendar sync, and import must belong to a real property and listing structure first."
            }
          >
            <div className="grid gap-4 lg:grid-cols-3">
              <div className="workspace-soft-card rounded-[24px] p-4">
                <p className="text-sm font-semibold text-[var(--workspace-text)]">{isSpanish ? "Casa completa" : "Single house"}</p>
                <p className="mt-2 text-sm leading-6 text-[var(--workspace-muted)]">
                  {isSpanish
                    ? "Elige esto cuando alquilas la vivienda completa como un solo listing. No hacen falta listings extra."
                    : "Choose this when you rent the full home as one listing. No extra listings are required."}
                </p>
              </div>
              <div className="workspace-soft-card rounded-[24px] p-4">
                <p className="text-sm font-semibold text-[var(--workspace-text)]">{isSpanish ? "Propiedad con varios listings" : "Multi-listing property"}</p>
                <p className="mt-2 text-sm leading-6 text-[var(--workspace-muted)]">
                  {isSpanish
                    ? "Dile a Hostlyx cuántos listings operas ahí y los crearemos automáticamente por ti."
                    : "Tell Hostlyx how many listings you operate there, and we will create them automatically for you."}
                </p>
              </div>
              <div className="workspace-soft-card rounded-[24px] p-4">
                <p className="text-sm font-semibold text-[var(--workspace-text)]">{isSpanish ? "Qué se desbloquea después" : "What unlocks next"}</p>
                <p className="mt-2 text-sm leading-6 text-[var(--workspace-muted)]">
                  {isSpanish
                    ? "Cuando exista la primera propiedad, dashboard, imports, bookings y expenses pasan a estar disponibles."
                    : "Once the first property exists, dashboard, imports, bookings, and expenses become available."}
                </p>
              </div>
            </div>
          </SectionCard>
        ) : null}

        <div className="grid gap-4 md:grid-cols-3">
          <SectionCard title={isSpanish ? "Propiedades" : "Properties"}>
            <div className="flex items-center gap-3">
              <div className="workspace-icon-chip rounded-2xl p-3">
                <Building2 className="h-5 w-5" />
              </div>
              <p className="text-2xl font-semibold text-[var(--workspace-text)]">
                {formatNumber(properties.length)}
              </p>
            </div>
          </SectionCard>
          <SectionCard title={isSpanish ? "Listings" : "Listings"}>
            <div className="flex items-center gap-3">
              <div className="workspace-icon-chip rounded-2xl p-3">
                <Layers3 className="h-5 w-5" />
              </div>
              <p className="text-2xl font-semibold text-[var(--workspace-text)]">
                {formatNumber(properties.reduce((sum, property) => sum + property.units.length, 0))}
              </p>
            </div>
          </SectionCard>
          <SectionCard title={isSpanish ? "Cómo usarlo" : "How to use it"}>
            <p className="text-sm leading-6 text-[var(--workspace-muted)]">
              {isSpanish
                ? "Las importaciones se asignan a la propiedad que elijas durante el upload. Los listings viven bajo esa propiedad, así que el sync de calendario y el seguimiento operativo pueden seguir siendo específicos del listing mientras el reporting se consolida limpio."
                : "Imports are assigned to the property you choose during upload. Listings live under that property, so calendar sync and operational tracking can stay listing-specific while reporting still rolls up cleanly."}
            </p>
          </SectionCard>
        </div>

        <SectionCard
          title={isSetupMode ? (isSpanish ? "Crea tu primera estructura de listings" : "Create Your First Listing Structure") : isSpanish ? "Setup de listings" : "Listings Setup"}
          subtitle={
            isSetupMode
              ? isSpanish
                ? "Dile a Hostlyx si esto es un alquiler de casa completa o una propiedad con varios listings."
                : "Tell Hostlyx whether this is a single-home rental or a property with several listings."
              : isSpanish
                ? "Crea primero la estructura de la cartera y luego asigna reservas y gastos a la propiedad y listing correctos."
                : "Create the portfolio structure first, then assign bookings and expenses to the right property and listing."
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
