import Link from "next/link";
import {
  ArrowDownUp,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  CircleCheckBig,
  Eye,
  FileSpreadsheet,
  GitCompare,
  LayoutDashboard,
  PiggyBank,
  Play,
  Tags,
  TrendingDown,
} from "lucide-react";
import { getAuthSession } from "@/lib/auth";
import { MarketingFooter } from "@/components/marketing-footer";
import { MarketingDashboardPreview } from "@/components/marketing-dashboard-preview";
import { MarketingHeader } from "@/components/marketing-header";
import { getRequestLocale } from "@/lib/server-locale";

const siteUrlLabel = "hostlyxone.netlify.app";
const hostInitials = ["AR", "MS", "JP", "LC"];

function getLandingCollections(isSpanish: boolean) {
  const problems = isSpanish
    ? [
        {
          icon: TrendingDown,
          title: "Ingresos ≠ beneficio",
          description:
            "Puedes tener reservas constantes y aun así no saber cuánto estás ganando realmente.",
          stat: "67%",
          statLabel: "de hosts sobrestiman su beneficio",
        },
        {
          icon: FileSpreadsheet,
          title: "Demasiados números, cero claridad",
          description: "Excel, plataformas, gastos… todo está disperso y no conecta.",
          stat: "4+",
          statLabel: "herramientas para entender el negocio",
        },
        {
          icon: Eye,
          title: "Decisiones sin datos reales",
          description: "Sin saber tu beneficio real, estás operando a ciegas.",
          stat: "82%",
          statLabel: "sin métricas realmente accionables",
        },
      ]
    : [
        {
          icon: TrendingDown,
          title: "Revenue ≠ profit",
          description: "You can have steady bookings and still not know what you are truly making.",
          stat: "67%",
          statLabel: "of hosts overestimate their profit",
        },
        {
          icon: FileSpreadsheet,
          title: "Too many numbers, zero clarity",
          description: "Excel, channels, expenses... everything is scattered and disconnected.",
          stat: "4+",
          statLabel: "tools just to understand the business",
        },
        {
          icon: Eye,
          title: "Decisions without real data",
          description: "If you do not know your real profit, you are operating blind.",
          stat: "82%",
          statLabel: "without truly actionable metrics",
        },
      ];

  const features = isSpanish
    ? [
        {
          icon: LayoutDashboard,
          title: "Beneficio real",
          description: "Ve con claridad financiera cuánto dinero te queda después de todo.",
        },
        {
          icon: BarChart3,
          title: "Gastos bajo control",
          description: "Identifica qué está reduciendo tu beneficio real.",
        },
        {
          icon: Tags,
          title: "Impuestos claros",
          description: "Calcula cuánto debes apartar y por qué tu dinero no siempre coincide.",
        },
        {
          icon: GitCompare,
          title: "Rendimiento por propiedad",
          description: "Descubre qué propiedades realmente generan dinero.",
        },
        {
          icon: PiggyBank,
          title: "Canales comparados",
          description: "Airbnb, Booking o directo: cuál te deja más.",
        },
        {
          icon: ArrowDownUp,
          title: "Flujo operativo",
          description: "Entiende payouts operativos, gastos y el movimiento neto del negocio sin confundirlo con conciliación bancaria.",
        },
      ]
    : [
        {
          icon: LayoutDashboard,
          title: "Real profit",
          description: "See with financial clarity how much money is left after everything.",
        },
        {
          icon: BarChart3,
          title: "Expenses under control",
          description: "Identify what is reducing your true profit.",
        },
        {
          icon: Tags,
          title: "Clear taxes",
          description: "Estimate what to set aside and why your money does not always match.",
        },
        {
          icon: GitCompare,
          title: "Performance by property",
          description: "Discover which properties are actually making money.",
        },
        {
          icon: PiggyBank,
          title: "Channels compared",
          description: "Airbnb, Booking, or direct: see which one leaves you more.",
        },
        {
          icon: ArrowDownUp,
          title: "Operating flow",
          description: "Understand operating payouts, expenses, and net business movement without confusing it with bank reconciliation.",
        },
      ];

  const alertSignals = isSpanish
    ? [
        {
          icon: TrendingDown,
          title: "Los gastos crecen más rápido que los ingresos",
          description: "Detecta presión operativa antes de que se coma lo que realmente te quedas.",
        },
        {
          icon: Tags,
          title: "Los impuestos reducen mucho tu take-home",
          description: "Ve cuándo los impuestos están golpeando fuerte tu beneficio real.",
        },
        {
          icon: GitCompare,
          title: "Dependes demasiado de un solo canal",
          description: "Entiende si Airbnb, Booking o un solo origen domina demasiado tu negocio.",
        },
      ]
    : [
        {
          icon: TrendingDown,
          title: "Expenses are growing faster than revenue",
          description: "Spot operational pressure before it eats what you actually keep.",
        },
        {
          icon: Tags,
          title: "Taxes are reducing your take-home significantly",
          description: "See when taxes are hitting your real profit too hard.",
        },
        {
          icon: GitCompare,
          title: "You are relying heavily on one channel",
          description: "Understand if Airbnb, Booking, or one source dominates too much of the business.",
        },
      ];

  const pricingPlans = isSpanish
    ? [
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
          features: ["Propiedades ilimitadas", "Analítica avanzada", "Funciones de equipo", "Acceso API"],
          highlighted: false,
        },
      ]
    : [
        {
          name: "Starter",
          tagline: "For one property",
          price: 19,
          description: "A simple starting point for hosts who want clarity without extra complexity.",
          features: ["1 property", "Excel import", "Full dashboard", "Tax estimate"],
          highlighted: false,
        },
        {
          name: "Pro",
          tagline: "For growing operators",
          price: 49,
          description: "The best option for hosts managing more than one property and needing more visibility.",
          features: ["Multiple properties", "Advanced reports", "Performance insights", "Priority support"],
          highlighted: true,
          badge: "Most popular",
        },
        {
          name: "Portfolio",
          tagline: "For large portfolios",
          price: 99,
          description: "Built for operators who need scale, deeper analytics, and more than one user.",
          features: ["Unlimited properties", "Advanced analytics", "Team features", "API access"],
          highlighted: false,
        },
      ];

  return { problems, features, alertSignals, pricingPlans };
}

export default async function LandingPage() {
  const locale = await getRequestLocale();
  const isSpanish = locale === "es";
  const session = await getAuthSession();
  const signedIn = Boolean(session?.user?.email);
  const { problems, features, alertSignals, pricingPlans } = getLandingCollections(isSpanish);
  const dashboardHref = signedIn ? "/dashboard" : "/login";

  return (
    <>
      <MarketingHeader activePage="home" signedIn={signedIn} primaryHref={dashboardHref} locale={locale} />

      <main className="pb-16">
        <section id="hero" className="relative overflow-hidden">
          <div className="absolute inset-0">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(88,196,182,0.22),transparent_34%),radial-gradient(circle_at_85%_18%,rgba(125,224,211,0.14),transparent_20%),linear-gradient(135deg,rgba(7,17,28,0.98)_0%,rgba(9,19,32,0.96)_45%,rgba(13,27,44,0.92)_100%)]" />
            <div className="absolute right-[-8rem] top-[-4rem] h-[24rem] w-[24rem] rounded-full bg-[var(--accent-soft)] blur-3xl lg:h-[30rem] lg:w-[30rem]" />
            <div className="absolute bottom-[-10rem] left-[-6rem] h-[18rem] w-[18rem] rounded-full bg-white/[0.04] blur-3xl" />
            <div className="absolute inset-0 bg-gradient-to-r from-[rgba(7,17,28,0.86)] via-[rgba(7,17,28,0.64)] to-[rgba(7,17,28,0.42)]" />
            <div className="absolute inset-0 bg-gradient-to-t from-[rgba(7,17,28,0.96)] via-transparent to-[rgba(7,17,28,0.24)]" />
          </div>

          <div className="relative z-[1] mx-auto flex min-h-[calc(100svh-4.5rem)] w-full max-w-7xl items-center px-4 pb-24 pt-16 sm:px-6 sm:pt-20 xl:px-8">
            <div className="grid w-full gap-12 xl:grid-cols-[minmax(0,1fr)_minmax(320px,440px)] xl:items-center xl:gap-14 2xl:grid-cols-[minmax(0,1.02fr)_minmax(360px,500px)] 2xl:gap-16">
              <div className="max-w-2xl">
                <div className="inline-flex items-center gap-2 rounded-full border border-[var(--accent-soft-strong)] bg-[var(--accent-soft)] px-4 py-1.5">
                  <div className="h-2 w-2 rounded-full bg-[var(--accent)] animate-pulse" />
                  <span className="text-xs font-medium uppercase tracking-[0.18em] text-[var(--accent-text)]">
                    {isSpanish ? "Sistema financiero para hosts" : "Financial system for hosts"}
                  </span>
                </div>

                <h1 className="mt-6 max-w-[15ch] text-balance text-4xl font-bold leading-[1.08] tracking-tight text-slate-100 sm:text-5xl lg:text-6xl xl:text-[4.5rem]">
                  {isSpanish ? "¿Cuánto te queda realmente de tu Airbnb?" : "How much does your Airbnb actually leave you?"}
                </h1>

                <p className="mt-6 max-w-xl text-lg leading-relaxed text-slate-300 sm:text-xl">
                  {isSpanish
                    ? "Deja de mirar ingresos. Empieza a ver lo que realmente ganas después de gastos e impuestos."
                    : "Stop staring at revenue. Start seeing what you actually keep after expenses and taxes."}
                </p>

                <div className="mt-8 flex flex-col gap-4 sm:flex-row">
                  <Link
                    href={dashboardHref}
                    className="brand-button inline-flex h-13 items-center justify-center gap-2 rounded-2xl px-8 text-base font-semibold transition"
                  >
                    {isSpanish ? "Empieza gratis" : "Start free"}
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                  <Link
                    href="#solution"
                    className="brand-button-secondary inline-flex h-13 items-center justify-center gap-2 rounded-2xl px-8 text-base font-semibold transition"
                  >
                    <Play className="h-4 w-4" />
                    {isSpanish ? "Ver demo" : "See demo"}
                  </Link>
                </div>

                <div className="mt-10 flex items-center gap-6">
                  <div className="flex -space-x-2">
                    {hostInitials.map((initials) => (
                      <div
                        key={initials}
                        aria-hidden="true"
                        className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-[var(--background)] bg-[linear-gradient(180deg,rgba(88,196,182,0.3)_0%,rgba(12,23,39,0.92)_100%)] text-[10px] font-semibold tracking-[0.12em] text-slate-100"
                      >
                        {initials}
                      </div>
                    ))}
                  </div>

                  <div>
                    <div className="flex items-center gap-1">
                      {Array.from({ length: 5 }).map((_, index) => (
                        <svg
                          key={index}
                          className="h-3.5 w-3.5 fill-[var(--accent)] text-[var(--accent)]"
                          viewBox="0 0 20 20"
                        >
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                      ))}
                    </div>
                    <p className="mt-1 text-xs text-slate-400">
                      {isSpanish ? "Usado por mas de 200 hosts en Espana" : "Used by 200+ hosts in Spain"}
                    </p>
                  </div>
                </div>

                <div className="mt-10 max-w-4xl xl:hidden">
                  <MarketingDashboardPreview compact variant="profit" />
                </div>
              </div>

              <div className="hidden xl:block">
                <div className="mx-auto w-full max-w-[460px] 2xl:max-w-[500px]">
                  <MarketingDashboardPreview compact variant="profit" />
                </div>
              </div>
            </div>
          </div>

          <div className="absolute bottom-0 left-0 right-0 h-28 bg-gradient-to-t from-[var(--background)] to-transparent" />
        </section>

        <section id="problem" className="mx-auto w-full max-w-7xl px-4 py-24 sm:px-6 sm:py-28 xl:px-8">
          <section className="mx-auto mb-24 w-full max-w-7xl px-0 sm:mb-28">
            <div className="overflow-hidden rounded-[32px] border border-white/8 bg-[linear-gradient(180deg,rgba(12,23,39,0.82)_0%,rgba(8,17,28,0.72)_100%)] shadow-[0_24px_60px_rgba(2,6,23,0.22)]">
              <div className="grid gap-8 px-6 py-8 lg:grid-cols-[1.15fr_0.85fr] lg:px-10 lg:py-10">
                <div>
                  <span className="text-xs font-medium uppercase tracking-[0.22em] text-[var(--accent-text)]">
                    {isSpanish ? "Conciliación" : "Reconciliation"}
                  </span>
                  <h2 className="mt-4 max-w-xl text-3xl font-semibold tracking-[-0.06em] text-slate-100 sm:text-4xl">
                    {isSpanish ? "Tus números no coinciden. Aquí está el porqué." : "Your numbers don&apos;t match. Here&apos;s why."}
                  </h2>
                  <p className="mt-4 max-w-2xl text-lg leading-8 text-slate-300">
                    {isSpanish
                      ? "Hostlyx compara lo que deberías recibir con lo que realmente te llega y te muestra exactamente dónde se va el dinero."
                      : "Hostlyx compares what you should receive with what you actually get and shows exactly where the money goes."}
                  </p>
                  <p className="mt-5 text-base leading-7 text-slate-400">
                    {isSpanish ? "Comisiones, impuestos y ajustes. Por fin explicados." : "Fees, taxes, and adjustments. Finally explained."}
                  </p>
                </div>

                <div className="rounded-[28px] border border-[var(--accent-soft-strong)] bg-[linear-gradient(180deg,rgba(88,196,182,0.08)_0%,rgba(17,28,44,0.88)_42%,rgba(11,22,37,0.96)_100%)] p-6">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                    {isSpanish ? "Conciliacion" : "Reconcile"}
                  </p>
                  <div className="mt-6 space-y-4">
                    <div className="flex items-end justify-between gap-4 border-b border-white/8 pb-4">
                      <div>
                        <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{isSpanish ? "Payout esperado" : "Expected payout"}</p>
                        <p className="mt-2 text-2xl font-semibold tracking-[-0.05em] text-slate-100">€8,110</p>
                      </div>
                      <GitCompare className="h-5 w-5 text-[var(--accent)]" />
                    </div>
                    <div className="flex items-end justify-between gap-4 border-b border-white/8 pb-4">
                      <div>
                        <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{isSpanish ? "Payout real" : "Actual payout"}</p>
                        <p className="mt-2 text-3xl font-semibold tracking-[-0.06em] text-slate-100">€7,500</p>
                      </div>
                      <CircleCheckBig className="h-5 w-5 text-[var(--accent)]" />
                    </div>
                    <div className="flex items-end justify-between gap-4">
                      <div>
                        <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{isSpanish ? "Diferencia" : "Difference"}</p>
                        <p className="mt-2 text-2xl font-semibold tracking-[-0.05em] text-amber-200">-€610</p>
                      </div>
                      <p className="max-w-[11rem] text-right text-sm leading-6 text-slate-400">
                        {isSpanish ? "Por fin se ve por qué tu dinero no cuadra." : "Why your money doesn&apos;t match is finally visible."}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="mx-auto mb-24 w-full max-w-7xl px-0 sm:mb-28">
            <div className="overflow-hidden rounded-[32px] border border-white/8 bg-[linear-gradient(180deg,rgba(12,23,39,0.76)_0%,rgba(8,17,28,0.62)_100%)] px-6 py-8 lg:px-10 lg:py-10">
              <div className="max-w-2xl">
                <span className="text-xs font-medium uppercase tracking-[0.22em] text-[var(--accent-text)]">
                  {isSpanish ? "Alertas" : "Alerts"}
                </span>
                <h2 className="mt-4 text-3xl font-semibold tracking-[-0.06em] text-slate-100 sm:text-4xl">
                  {isSpanish ? "Deja de adivinar. Empieza a saber qué corregir." : "Stop guessing. Start knowing what to fix."}
                </h2>
                <p className="mt-4 text-lg leading-8 text-slate-300">
                  {isSpanish ? "Hostlyx resalta lo que importa para que puedas actuar." : "Hostlyx highlights what matters so you can act."}
                </p>
              </div>

              <div className="mt-10 grid gap-5 lg:grid-cols-3">
                {alertSignals.map((signal) => {
                  const Icon = signal.icon;

                  return (
                    <article
                      key={signal.title}
                      className="rounded-[24px] border border-white/8 bg-[linear-gradient(180deg,rgba(17,28,44,0.78)_0%,rgba(10,19,31,0.68)_100%)] p-6"
                    >
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--accent-soft-strong)] bg-[var(--accent-soft)]">
                        <Icon className="h-4 w-4 text-[var(--accent-text)]" />
                      </div>
                      <h3 className="mt-5 text-lg font-semibold leading-7 text-slate-100">{signal.title}</h3>
                      <p className="mt-3 text-sm leading-7 text-slate-400">{signal.description}</p>
                    </article>
                  );
                })}
              </div>

              <p className="mt-8 text-sm font-medium text-slate-300">{isSpanish ? "Señales claras. Sin ruido." : "Clear signals. No noise."}</p>
            </div>
          </section>

          <div className="text-center">
            <span className="text-xs font-medium uppercase tracking-[0.22em] text-[var(--accent-text)]">
              {isSpanish ? "El problema" : "The problem"}
            </span>
            <h2 className="mt-4 text-3xl font-semibold tracking-[-0.06em] text-slate-100 sm:text-4xl lg:text-5xl">
              {isSpanish ? "No es falta de ingresos. Es falta de claridad." : "The issue is not revenue. It is clarity."}
            </h2>
          </div>

          <div className="mt-16 grid gap-6 md:grid-cols-3">
            {problems.map((problem) => {
              const Icon = problem.icon;

              return (
                <article
                  key={problem.title}
                  className="rounded-[28px] border border-white/8 bg-[linear-gradient(180deg,rgba(12,23,39,0.76)_0%,rgba(8,17,28,0.62)_100%)] p-8"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-[var(--accent-soft-strong)] bg-[var(--accent-soft)]">
                    <Icon className="h-5 w-5 text-[var(--accent-text)]" />
                  </div>
                  <h3 className="mt-6 text-xl font-semibold text-slate-100">{problem.title}</h3>
                  <p className="mt-3 text-sm leading-7 text-slate-400">{problem.description}</p>
                  <div className="mt-6 border-t border-white/8 pt-6">
                    <p className="text-3xl font-semibold tracking-[-0.04em] text-[var(--accent)]">{problem.stat}</p>
                    <p className="mt-1 text-xs text-slate-500">{problem.statLabel}</p>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <section id="solution" className="relative overflow-hidden py-24 sm:py-28">
          <div className="pointer-events-none absolute left-1/2 top-1/2 h-[500px] w-[800px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--accent-soft)] blur-3xl" />

          <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 xl:px-8">
            <div className="text-center">
              <span className="text-xs font-medium uppercase tracking-[0.22em] text-[var(--accent-text)]">
                {isSpanish ? "La solución" : "The solution"}
              </span>
              <h2 className="mt-4 text-3xl font-semibold tracking-[-0.06em] text-slate-100 sm:text-4xl lg:text-5xl">
                {isSpanish ? "Lo único que importa: lo que realmente te quedas." : "The only thing that matters: what you actually keep."}
              </h2>
              <p className="mx-auto mt-4 max-w-2xl text-lg leading-8 text-slate-300">
                {isSpanish
                  ? "Hostlyx convierte tus ingresos, gastos e impuestos en una sola cifra clara: tu beneficio real y por qué tu dinero no siempre coincide."
                  : "Hostlyx turns your revenue, expenses, and taxes into one clear number: your real profit and why your money does not always match."}
              </p>
              <p className="mx-auto mt-3 max-w-2xl text-base leading-7 text-slate-400">
                {isSpanish ? "Sin hojas de cálculo. Sin suposiciones. Sin autoengaños." : "No spreadsheets. No guessing. No self-deception."}
              </p>
            </div>

            <div className="relative mt-16">
              <div className="overflow-hidden rounded-[28px] border border-white/8 bg-[linear-gradient(180deg,rgba(17,28,44,0.92)_0%,rgba(11,22,37,0.98)_100%)] shadow-[0_28px_80px_rgba(2,6,23,0.3)]">
                <div className="flex items-center gap-2 border-b border-white/8 bg-white/[0.03] px-4 py-3">
                  <div className="flex gap-1.5">
                    <div className="h-3 w-3 rounded-full bg-rose-400/40" />
                    <div className="h-3 w-3 rounded-full bg-amber-300/40" />
                    <div className="h-3 w-3 rounded-full bg-[var(--accent)]/40" />
                  </div>
                  <div className="mx-4 flex-1">
                    <div className="mx-auto max-w-xs rounded-lg bg-white/[0.04] px-4 py-1.5 text-center text-xs text-slate-400">
                      {siteUrlLabel}/dashboard
                    </div>
                  </div>
                </div>

                <div className="p-4 sm:p-5">
                  <MarketingDashboardPreview variant="feature" />
                </div>
              </div>

              <div className="absolute -left-4 top-1/3 hidden lg:block">
                <div className="rounded-xl border border-white/10 bg-[linear-gradient(180deg,rgba(17,28,44,0.96)_0%,rgba(11,22,37,0.96)_100%)] p-4 shadow-[0_20px_40px_rgba(2,6,23,0.24)]">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">
                    {isSpanish ? "Resumen real" : "Real snapshot"}
                  </p>
                  <div className="mt-3 space-y-2 text-sm text-slate-300">
                    <p>{isSpanish ? "Ingresos" : "Revenue"}: €18,142</p>
                    <p>{isSpanish ? "Gastos" : "Expenses"}: €12,524</p>
                    <p>{isSpanish ? "Impuestos" : "Taxes"}: €823</p>
                    <p className="font-semibold text-[var(--accent)]">{isSpanish ? "Te quedas: €2,605" : "You keep: €2,605"}</p>
                  </div>
                </div>
              </div>

              <div className="absolute -right-4 top-1/4 hidden lg:block">
                <div className="rounded-xl border border-white/10 bg-[linear-gradient(180deg,rgba(17,28,44,0.96)_0%,rgba(11,22,37,0.96)_100%)] p-4 shadow-[0_20px_40px_rgba(2,6,23,0.24)]">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">
                    {isSpanish ? "La cifra clave" : "The key number"}
                  </p>
                  <p className="mt-2 max-w-[11rem] text-base font-semibold leading-6 text-slate-100">
                    {isSpanish ? "Esto es lo que realmente te queda." : "This is what you actually keep."}
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-12 text-center">
              <Link
                href={dashboardHref}
                className="brand-button inline-flex items-center gap-2 rounded-2xl px-8 py-4 text-base font-semibold transition"
              >
                {isSpanish ? "Empieza gratis" : "Start free"}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </section>

        <section id="features" className="mx-auto w-full max-w-7xl px-4 py-24 sm:px-6 sm:py-28 xl:px-8">
          <div className="text-center">
            <span className="text-xs font-medium uppercase tracking-[0.22em] text-[var(--accent-text)]">
              {isSpanish ? "Funcionalidades" : "Features"}
            </span>
            <h2 className="mt-4 text-3xl font-semibold tracking-[-0.06em] text-slate-100 sm:text-4xl lg:text-5xl">
              {isSpanish ? "Todo lo que necesitas para entender tu negocio" : "Everything you need to understand the business"}
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-lg leading-8 text-slate-300">
              {isSpanish ? "Claridad financiera, beneficio real y lo que realmente te queda en un solo sitio." : "Financial clarity, real profit, and what you actually keep in one place."}
            </p>
          </div>

          <div className="mt-16 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => {
              const Icon = feature.icon;

              return (
                <article
                  key={feature.title}
                  className="group rounded-[24px] border border-white/8 bg-[linear-gradient(180deg,rgba(12,23,39,0.74)_0%,rgba(8,17,28,0.6)_100%)] p-6 transition-all duration-300 hover:border-[var(--accent)]/30"
                >
                  <div className="flex items-start gap-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[var(--accent-soft-strong)] bg-[var(--accent-soft)] transition-colors group-hover:bg-[rgba(88,196,182,0.22)]">
                      <Icon className="h-4 w-4 text-[var(--accent-text)]" />
                    </div>
                    <div>
                      <h3 className="text-base font-semibold text-slate-100">{feature.title}</h3>
                      <p className="mt-1.5 text-sm leading-7 text-slate-400">{feature.description}</p>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <section id="pricing" className="mx-auto w-full max-w-7xl px-4 py-24 sm:px-6 sm:py-28 xl:px-8">
          <div className="text-center">
            <span className="text-xs font-medium uppercase tracking-[0.22em] text-[var(--accent-text)]">
              {isSpanish ? "Precios" : "Pricing"}
            </span>
            <h2 className="mt-4 text-3xl font-semibold tracking-[-0.06em] text-slate-100 sm:text-4xl lg:text-5xl">
              {isSpanish ? (
                <>
                  Simple, transparente, <span className="text-[var(--accent)]">sin sorpresas.</span>
                </>
              ) : (
                <>
                  Simple, transparent, <span className="text-[var(--accent)]">no surprises.</span>
                </>
              )}
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-lg leading-8 text-slate-300">
              {isSpanish ? "Elige el plan que se adapta a tu negocio. Cancela cuando quieras." : "Choose the plan that fits your business. Cancel whenever you want."}
            </p>
          </div>

          <div className="mt-16 grid items-start gap-5 md:grid-cols-3">
            {pricingPlans.map((plan) => (
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

                <Link
                  href={dashboardHref}
                  className={`inline-flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                    plan.highlighted
                      ? "brand-button shadow-[0_18px_36px_rgba(88,196,182,0.2)]"
                      : "border border-white/8 bg-white/[0.04] text-slate-100 hover:bg-white/[0.08]"
                  }`}
                >
                  {isSpanish ? "Empezar" : "Start"}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </article>
            ))}
          </div>
        </section>

        <section className="mx-auto w-full max-w-7xl px-4 py-24 sm:px-6 sm:py-28 xl:px-8">
          <div className="relative overflow-hidden rounded-[32px] border border-white/8">
            <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(88,196,182,0.16)_0%,rgba(17,28,44,0.9)_40%,rgba(11,22,37,0.94)_100%)]" />
            <div className="absolute right-0 top-0 h-96 w-96 rounded-full bg-[var(--accent-soft)] blur-3xl" />
            <div className="absolute bottom-0 left-0 h-64 w-64 rounded-full bg-white/[0.04] blur-3xl" />

            <div className="relative px-8 py-16 text-center sm:px-16 sm:py-24">
              <h2 className="mx-auto max-w-3xl text-3xl font-semibold tracking-[-0.06em] text-slate-100 sm:text-4xl lg:text-5xl">
                {isSpanish ? (
                  <>
                    Empieza con tus datos. <br />
                    <span className="text-[var(--accent)]">Quédate con la claridad.</span>
                  </>
                ) : (
                  <>
                    Start with your data. <br />
                    <span className="text-[var(--accent)]">Keep the clarity.</span>
                  </>
                )}
              </h2>
              <p className="mx-auto mt-6 max-w-xl text-lg leading-8 text-slate-300">
                {isSpanish ? "Sube tu Excel y descubre en minutos cuánto estás ganando realmente." : "Upload your Excel and discover in minutes how much you are really making."}
              </p>

              <div className="mt-10 flex flex-col justify-center gap-4 sm:flex-row">
                <Link
                  href={dashboardHref}
                  className="brand-button inline-flex items-center justify-center gap-2 rounded-2xl px-10 py-4 text-base font-semibold transition"
                >
                  {isSpanish ? "Sube tus datos" : "Upload your data"}
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/pricing"
                  className="brand-button-secondary inline-flex items-center justify-center rounded-2xl px-10 py-4 text-base font-semibold transition"
                >
                  {isSpanish ? "Ver precios" : "See pricing"}
                </Link>
              </div>

              <div className="mt-10 flex flex-wrap justify-center gap-8 text-sm text-slate-400">
                {[
                  isSpanish ? "Sin tarjeta de crédito" : "No credit card required",
                  isSpanish ? "Configura en minutos" : "Set up in minutes",
                  isSpanish ? "Importa desde Airbnb y Booking" : "Import from Airbnb and Booking",
                ].map((item) => (
                  <span key={item} className="flex items-center gap-2">
                    <div className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />
                    {item}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </section>
      </main>

      <MarketingFooter locale={locale} />
    </>
  );
}
