import Link from "next/link";
import { redirect } from "next/navigation";
import { buildDashboardView, getDashboardFilters } from "@/lib/dashboard";
import {
  getBookings,
  getExpenses,
  getFinancialDocuments,
  getLatestImport,
  getSubscriptionState,
  getUserSettings,
} from "@/lib/db";
import { getAuthSession } from "@/lib/auth";
import { DashboardShell } from "@/components/dashboard-shell";
import { SubscriptionUpgradeCard } from "@/components/subscription-upgrade-card";
import { WorkspaceShell } from "@/components/workspace-shell";
import { getOnboardingState } from "@/lib/onboarding";
import {
  canAccessDashboard,
  canAccessInsights,
  canAccessReports,
  getSubscriptionBadge,
  getTrialDaysLeft,
} from "@/lib/subscription";
import { getRequestLocale } from "@/lib/server-locale";

export const runtime = "nodejs";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function DashboardPage({
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
  const onboardingState = await getOnboardingState(ownerEmail, userName);
  const properties = onboardingState.properties;

  if (!onboardingState.isComplete) {
    redirect("/onboarding");
  }

  const [subscription, latestImport, userSettings] = await Promise.all([
    getSubscriptionState(ownerEmail),
    getLatestImport(ownerEmail),
    getUserSettings(ownerEmail, userName),
  ]);
  const subscriptionBadge = getSubscriptionBadge(subscription);

  if (!canAccessDashboard(subscription)) {
    const trialDaysLeft = getTrialDaysLeft(subscription);

    return (
      <WorkspaceShell
        activePage="dashboard"
        pageTitle={isSpanish ? "Dashboard bloqueado" : "Dashboard Locked"}
        pageSubtitle={
          isSpanish
            ? "Tu prueba gratuita ha terminado. Actualiza para seguir usando el dashboard financiero."
            : "Your free trial has ended. Upgrade to keep using the financial dashboard."
        }
        businessName={userSettings.businessName}
        userName={userName}
        userEmail={ownerEmail}
        currencyCode={userSettings.currencyCode}
        latestImport={latestImport}
        subscriptionBadge={subscriptionBadge}
        actions={
          <Link
            href="/pricing"
            className="rounded-2xl border border-amber-200/18 bg-[linear-gradient(135deg,rgba(251,191,36,0.24)_0%,rgba(245,158,11,0.16)_100%)] px-4 py-3 text-sm font-semibold text-amber-50 shadow-[0_18px_36px_rgba(245,158,11,0.18)] transition hover:border-amber-200/28 hover:bg-[linear-gradient(135deg,rgba(251,191,36,0.3)_0%,rgba(245,158,11,0.2)_100%)]"
          >
            {isSpanish ? "Elegir un plan" : "Choose a Plan"}
          </Link>
        }
      >
        <div className="space-y-6">
          <SubscriptionUpgradeCard
            title={isSpanish ? "Actualiza para reabrir tu dashboard" : "Upgrade to reopen your dashboard"}
            description={
              trialDaysLeft > 0
                ? isSpanish
                  ? "Tu prueba de 7 días está a punto de terminar. Elige un plan ahora para mantener acceso al dashboard sin interrupciones."
                  : "Your 7-day trial is almost over. Choose a plan now to keep access to the dashboard without interruption."
                : isSpanish
                  ? "Tus reservas, gastos y archivos importados siguen a salvo en Hostlyx. Elige un plan de pago para seguir usando el dashboard."
                  : "Your bookings, expenses, and imported files are still safe in Hostlyx. Choose a paid plan to keep using the dashboard."
            }
          />
        </div>
      </WorkspaceShell>
    );
  }

  const [bookings, expenses, financialDocuments] = await Promise.all([
    getBookings(ownerEmail),
    getExpenses(ownerEmail),
    getFinancialDocuments(ownerEmail),
  ]);
  const resolvedSearchParams = await searchParams;
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
    <DashboardShell
      view={view}
      latestImport={latestImport}
      userName={userName}
      userEmail={ownerEmail}
      businessName={userSettings.businessName}
      currencyCode={view.displayCurrencyCode}
      properties={properties}
      pageTitle={isSpanish ? "Visión financiera" : "Financial Overview"}
      pageSubtitle={
        isSpanish
          ? "Sigue lo que el negocio ingresó, gastó y retuvo durante el periodo seleccionado."
          : "Track what the business earned, spent, and kept during the selected period."
      }
      insightsEnabled={canAccessInsights(subscription)}
      reportExportEnabled={canAccessReports(subscription)}
      subscriptionBadge={subscriptionBadge}
      showUpgradeAction={subscription.status !== "active" || subscription.plan === "starter"}
    />
  );
}
