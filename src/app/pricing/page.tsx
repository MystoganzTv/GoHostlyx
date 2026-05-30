import Link from "next/link";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { getAuthSession } from "@/lib/auth";
import { getSubscriptionState } from "@/lib/db";
import { getSubscriptionBadge } from "@/lib/subscription";
import { MarketingFooter } from "@/components/marketing-footer";
import { MarketingHeader } from "@/components/marketing-header";
import { SubscriptionPlanButton } from "@/components/subscription-plan-button";
import { getRequestLocale } from "@/lib/server-locale";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

type PricingPlan = {
  name: "Starter" | "Pro" | "Portfolio";
  tagline: string;
  price: number;
  description: string;
  features: string[];
  highlighted: boolean;
  badge?: string;
};

const plans: PricingPlan[] = [
  {
    name: "Starter",
    tagline: "Para una propiedad",
    price: 19,
    description:
      "Un punto de partida sencillo para hosts que quieren claridad sin añadir complejidad.",
    features: ["1 propiedad", "Importación Excel", "Dashboard completo", "Estimación fiscal"],
    highlighted: false,
  },
  {
    name: "Pro",
    tagline: "Para operadores en crecimiento",
    price: 49,
    description:
      "La mejor opción para hosts que gestionan más de una propiedad y quieren mayor visibilidad.",
    features: ["Múltiples propiedades", "Informes avanzados", "Insights de rendimiento", "Soporte prioritario"],
    highlighted: true,
    badge: "Más popular",
  },
  {
    name: "Portfolio",
    tagline: "Para carteras grandes",
    price: 99,
    description:
      "Diseñado para operadores que necesitan escala, analítica profunda y más de un usuario.",
    features: ["Propiedades ilimitadas", "Analítica avanzada", "Funciones de equipo", "API access"],
    highlighted: false,
  },
];

export default async function PricingPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const locale = await getRequestLocale();
  const isSpanish = locale === "es";
  const resolvedSearchParams = await searchParams;
  const session = await getAuthSession();
  const signedIn = Boolean(session?.user?.email);
  const subscription =
    signedIn && session?.user?.email
      ? await getSubscriptionState(session.user.email.toLowerCase())
      : null;
  const subscriptionBadge = subscription ? getSubscriptionBadge(subscription) : null;
  const primaryCtaHref = signedIn ? "/dashboard" : "/login";
  const billingState =
    typeof resolvedSearchParams.billing === "string" ? resolvedSearchParams.billing : undefined;

  return (
    <>
      <MarketingHeader activePage="pricing" signedIn={signedIn} primaryHref={primaryCtaHref} locale={locale} />

      <main className="mx-auto w-full max-w-7xl px-4 pb-16 pt-10 sm:px-6 xl:px-8">
        <section className="text-center">
          <p className="text-xs font-medium uppercase tracking-[0.22em] text-[var(--accent-text)]">
            {isSpanish ? "Precios" : "Pricing"}
          </p>
          <h1 className="mt-4 text-4xl font-bold tracking-tight text-slate-100 sm:text-5xl lg:text-6xl">
            {isSpanish ? (
              <>
                Simple, transparente, <span className="text-[var(--accent)]">sin sorpresas.</span>
              </>
            ) : (
              <>
                Simple, transparent, <span className="text-[var(--accent)]">no surprises.</span>
              </>
            )}
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-lg leading-8 text-slate-300">
            {isSpanish
              ? "Elige el plan que se adapta a tu negocio. Cancela cuando quieras."
              : "Choose the plan that fits your business. Cancel whenever you want."}
          </p>
          {subscriptionBadge ? (
            <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-slate-200">
              <span className="font-semibold">{subscriptionBadge.label}</span>
              <span className="text-slate-400">•</span>
              <span className="text-slate-400">{subscriptionBadge.detail}</span>
            </div>
          ) : null}
          {billingState === "success" ? (
            <div className="mx-auto mt-6 max-w-xl rounded-2xl border border-emerald-400/18 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100">
              {isSpanish
                ? "El checkout de Stripe se completó. Tu plan se actualizará en Hostlyx en cuanto el webhook de facturación confirme la suscripción."
                : "Stripe checkout completed. Your plan will refresh in Hostlyx as soon as the billing webhook confirms the subscription."}
            </div>
          ) : null}
          {billingState === "cancelled" ? (
            <div className="mx-auto mt-6 max-w-xl rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-slate-300">
              {isSpanish
                ? "El checkout se canceló. Tus datos siguen a salvo y puedes actualizar cuando quieras."
                : "Checkout was cancelled. Your data is still safe, and you can upgrade again anytime."}
            </div>
          ) : null}
        </section>

        <section className="mt-16 grid items-start gap-5 md:grid-cols-3">
          {plans.map((plan) => (
            <article
              key={plan.name}
              className={`relative rounded-[28px] border p-8 transition-all duration-300 ${
                plan.highlighted
                  ? "scale-[1.02] border-[var(--accent)]/40 bg-[rgba(88,196,182,0.06)] shadow-[0_24px_50px_rgba(88,196,182,0.12)]"
                  : "bg-[linear-gradient(180deg,rgba(12,23,39,0.76)_0%,rgba(8,17,28,0.62)_100%)] border-white/8"
              }`}
            >
              {plan.badge ? (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                  <span className="rounded-full bg-[var(--accent)] px-4 py-1.5 text-xs font-bold uppercase tracking-[0.18em] text-[var(--accent-contrast)]">
                    {plan.badge}
                  </span>
                </div>
              ) : null}

              <div className="mb-6">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--accent-text)]">
                  {plan.name}
                </p>
                <p className="mt-1 text-sm text-slate-400">{plan.tagline}</p>
              </div>

              <div className="mb-6 flex items-end gap-1">
                <span className="text-5xl font-bold tracking-tight text-slate-100">€{plan.price}</span>
                <span className="mb-2 text-slate-400">{isSpanish ? "/mes" : "/month"}</span>
              </div>

              <p className="min-h-[84px] text-sm leading-7 text-slate-400">{plan.description}</p>

              <ul className="mb-8 mt-8 space-y-3">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-center gap-3">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-[var(--accent)]" />
                    <span className="text-sm text-slate-300">{feature}</span>
                  </li>
                ))}
              </ul>

              {signedIn ? (
                <SubscriptionPlanButton
                  plan={plan.name.toLowerCase() as "starter" | "pro" | "portfolio"}
                  currentPlan={subscription?.status === "active" ? subscription.plan : "trial"}
                  redirectTo="/pricing"
                  labels={{
                    currentPlan: "Plan actual",
                    starter: isSpanish ? "Empezar" : "Start",
                    pro: isSpanish ? "Empezar" : "Start",
                    portfolio: isSpanish ? "Empezar" : "Start",
                    loading: isSpanish ? "Actualizando..." : "Updating...",
                    error: isSpanish ? "No se pudo actualizar el plan." : "The plan could not be updated.",
                  }}
                  className={`w-full rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                    plan.highlighted
                      ? "brand-button shadow-[0_18px_36px_rgba(88,196,182,0.2)]"
                      : "border border-white/8 bg-white/[0.04] text-slate-100 hover:bg-white/[0.08]"
                  }`}
                />
              ) : (
                <Link
                  href={primaryCtaHref}
                  className={`inline-flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                    plan.highlighted
                      ? "brand-button shadow-[0_18px_36px_rgba(88,196,182,0.2)]"
                      : "border border-white/8 bg-white/[0.04] text-slate-100 hover:bg-white/[0.08]"
                  }`}
                >
                  {isSpanish ? "Empezar" : "Start"}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              )}
            </article>
          ))}
        </section>
      </main>

      <MarketingFooter locale={locale} />
    </>
  );
}
