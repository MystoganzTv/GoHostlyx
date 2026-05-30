import Link from "next/link";
import { redirect } from "next/navigation";
import { SectionCard } from "@/components/section-card";
import { WorkspaceShell } from "@/components/workspace-shell";
import { getAuthSession } from "@/lib/auth";
import {
  getLatestImport,
  getPropertyDefinitions,
  getUserSettings,
} from "@/lib/db";
import { getRequestLocale } from "@/lib/server-locale";

export const runtime = "nodejs";

export default async function ReconcilePage() {
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

  const [latestImport, userSettings] = await Promise.all([
    getLatestImport(ownerEmail),
    getUserSettings(ownerEmail, userName),
  ]);

  return (
    <WorkspaceShell
      activePage="reconcile"
      pageTitle={isSpanish ? "Conciliación bancaria" : "Bank Reconcile"}
      pageSubtitle={
        isSpanish
          ? "Aquí irá la conciliación entre payouts de canal y depósitos bancarios reales."
          : "This is where channel payouts will reconcile against real bank deposits."
      }
      businessName={userSettings.businessName}
      userName={userName}
      userEmail={ownerEmail}
      currencyCode={userSettings.currencyCode}
      latestImport={latestImport}
    >
      <div className="space-y-6">
        <SectionCard
          title={isSpanish ? "Todavía no hay banco conectado" : "No bank source connected yet"}
          subtitle={
            isSpanish
              ? "No uses aquí los CSV de Airbnb o Booking.com. Esos archivos ahora viven en Payouts."
              : "Do not use Airbnb or Booking.com CSVs here. Those files now live in Payouts."
          }
        >
          <div className="space-y-4">
            <p className="max-w-3xl text-sm leading-7 text-[var(--workspace-muted)]">
              {isSpanish
                ? "La idea correcta de Reconcile es comparar lo que el canal dice que pagó contra lo que realmente entró en tu banco. Aquí acabará entrando un CSV bancario o una conexión tipo Plaid."
                : "The right job for Reconcile is comparing what the channel says it paid against what actually landed in your bank. This will eventually take a bank CSV or a Plaid-style connection."}
            </p>

            <div className="grid gap-4 lg:grid-cols-2">
              <div className="workspace-soft-card rounded-[24px] p-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--workspace-muted)]">
                  {isSpanish ? "Lo que sí va aquí" : "What belongs here"}
                </p>
                <p className="mt-3 text-sm leading-6 text-[var(--workspace-text)]">
                  {isSpanish
                    ? "Extractos bancarios, CSV del banco y conexiones de cuenta para validar depósitos reales."
                    : "Bank statements, bank CSVs, and account connections to validate real deposits."}
                </p>
              </div>

              <div className="workspace-soft-card rounded-[24px] p-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--workspace-muted)]">
                  {isSpanish ? "Lo que ya movimos" : "What moved out"}
                </p>
                <p className="mt-3 text-sm leading-6 text-[var(--workspace-text)]">
                  {isSpanish
                    ? "Los statements de payout de Airbnb o Booking.com ahora viven en Payouts, porque siguen siendo datos del canal, no del banco."
                    : "Airbnb and Booking.com payout statements now live in Payouts, because they are still channel-side data, not bank data."}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Link
                href="/dashboard/payouts"
                className="workspace-button-primary inline-flex rounded-2xl px-4 py-3 text-sm font-semibold transition"
              >
                {isSpanish ? "Ir a Payouts" : "Go to Payouts"}
              </Link>
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-[var(--workspace-muted)]">
                {isSpanish ? "Plaid / banco próximamente" : "Plaid / bank feed coming soon"}
              </span>
            </div>
          </div>
        </SectionCard>
      </div>
    </WorkspaceShell>
  );
}
