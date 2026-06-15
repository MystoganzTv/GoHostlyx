import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  GitCompare,
  LayoutDashboard,
  PiggyBank,
  ShieldCheck,
  Tags,
  TrendingDown,
  Upload,
} from "lucide-react";
import { getAuthSession } from "@/lib/auth";
import { MarketingFooter } from "@/components/marketing-footer";
import { MarketingHeader } from "@/components/marketing-header";
import { getRequestLocale } from "@/lib/server-locale";

const hostInitials = ["AR", "MS", "JP", "LC"];
const chartBars = [38, 52, 46, 63, 57, 82];

function getLandingCollections(isSpanish: boolean) {
  const valueProps = isSpanish
    ? [
        {
          icon: LayoutDashboard,
          title: "Beneficio real, no ingresos",
          description: "Una sola cifra clara: lo que te queda después de gastos e impuestos.",
        },
        {
          icon: GitCompare,
          title: "Por qué tu dinero no cuadra",
          description: "Compara el payout esperado con el real y ve a dónde va cada euro.",
        },
        {
          icon: BarChart3,
          title: "Decisiones con datos",
          description: "Rendimiento por propiedad y canal para saber qué te deja más.",
        },
      ]
    : [
        {
          icon: LayoutDashboard,
          title: "Real profit, not revenue",
          description: "One clear number: what you keep after expenses and taxes.",
        },
        {
          icon: GitCompare,
          title: "Why your money never matches",
          description: "Compare expected vs. actual payout and see where every euro goes.",
        },
        {
          icon: BarChart3,
          title: "Decisions backed by data",
          description: "Performance by property and channel, so you know what pays off.",
        },
      ];

  const features = isSpanish
    ? [
        { icon: LayoutDashboard, title: "Beneficio real", description: "Ve con claridad cuánto dinero te queda después de todo." },
        { icon: BarChart3, title: "Gastos bajo control", description: "Identifica qué está reduciendo tu beneficio real." },
        { icon: Tags, title: "Impuestos claros", description: "Calcula cuánto apartar y por qué tu dinero no siempre coincide." },
        { icon: GitCompare, title: "Rendimiento por propiedad", description: "Descubre qué propiedades generan dinero de verdad." },
        { icon: PiggyBank, title: "Canales comparados", description: "Airbnb, Booking o directo: cuál te deja más." },
        { icon: TrendingDown, title: "Flujo operativo", description: "Entiende payouts, gastos y el movimiento neto del negocio." },
      ]
    : [
        { icon: LayoutDashboard, title: "Real profit", description: "See clearly how much money is left after everything." },
        { icon: BarChart3, title: "Expenses under control", description: "Identify what is reducing your true profit." },
        { icon: Tags, title: "Clear taxes", description: "Estimate what to set aside and why your money never quite matches." },
        { icon: GitCompare, title: "Performance by property", description: "Discover which properties actually make money." },
        { icon: PiggyBank, title: "Channels compared", description: "Airbnb, Booking, or direct: see which one leaves you more." },
        { icon: TrendingDown, title: "Operating flow", description: "Understand payouts, expenses, and the net movement of the business." },
      ];

  const pricingPlans = isSpanish
    ? [
        {
          name: "Starter",
          tagline: "Para una propiedad",
          price: 19,
          description: "Un punto de partida sencillo para hosts que quieren claridad sin complejidad.",
          features: ["1 propiedad", "Importación Excel", "Dashboard completo", "Estimación fiscal"],
          highlighted: false,
        },
        {
          name: "Pro",
          tagline: "Para operadores en crecimiento",
          price: 49,
          description: "La mejor opción para hosts con más de una propiedad que quieren más visibilidad.",
          features: ["Múltiples propiedades", "Informes avanzados", "Insights de rendimiento", "Soporte prioritario"],
          highlighted: true,
          badge: "Más popular",
        },
        {
          name: "Portfolio",
          tagline: "Para carteras grandes",
          price: 99,
          description: "Para operadores que necesitan escala, analítica profunda y más de un usuario.",
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
          description: "The best option for hosts managing more than one property who need more visibility.",
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

  return { valueProps, features, pricingPlans };
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--accent-text)]">
      {children}
    </span>
  );
}

function ProfitPreview({ isSpanish }: { isSpanish: boolean }) {
  return (
    <div className="marketing-dashboard-preview rounded-[26px] p-5 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-slate-500">
            {isSpanish ? "Beneficio neto" : "Net profit"}
          </p>
          <p className="mt-3 font-mono text-4xl font-semibold tracking-tight text-white sm:text-5xl">
            €9,654
          </p>
          <p className="mt-2 text-xs text-[var(--accent-text)]">
            {isSpanish ? "Después de gastos e impuestos" : "After expenses and taxes"}
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--accent-soft-strong)] bg-[var(--accent-soft)] px-3 py-1.5 text-xs font-semibold text-[var(--accent-text)]">
          <TrendingDown className="h-3.5 w-3.5 rotate-180" aria-hidden="true" />
          {isSpanish ? "Margen 20,6%" : "20.6% margin"}
        </span>
      </div>

      <div className="mt-7 flex h-28 items-end gap-2.5" aria-hidden="true">
        {chartBars.map((height, index) => (
          <div key={index} className="flex flex-1 items-end self-stretch">
            <div
              className="w-full rounded-lg bg-[linear-gradient(180deg,var(--accent-hover)_0%,var(--accent)_100%)]"
              style={{ height: `${height}%` }}
            />
          </div>
        ))}
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-white/[0.04] p-4">
          <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
            {isSpanish ? "Ingresos" : "Revenue"}
          </p>
          <p className="mt-2 font-mono text-xl font-semibold text-slate-100">€46,857</p>
        </div>
        <div className="rounded-2xl bg-white/[0.04] p-4">
          <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
            {isSpanish ? "Gastos" : "Expenses"}
          </p>
          <p className="mt-2 font-mono text-xl font-semibold text-slate-100">€37,203</p>
        </div>
      </div>
    </div>
  );
}

export default async function LandingPage() {
  const locale = await getRequestLocale();
  const isSpanish = locale === "es";
  const session = await getAuthSession();
  const signedIn = Boolean(session?.user?.email);
  const { valueProps, features, pricingPlans } = getLandingCollections(isSpanish);
  const dashboardHref = signedIn ? "/dashboard" : "/login";

  const ctaBullets = isSpanish
    ? ["Sin tarjeta de crédito", "Configura en minutos", "Importa desde Airbnb y Booking"]
    : ["No credit card required", "Set up in minutes", "Import from Airbnb and Booking"];

  return (
    <>
      <MarketingHeader activePage="home" signedIn={signedIn} primaryHref={dashboardHref} locale={locale} />

      <main>
        <section id="hero" className="relative overflow-hidden">
          <div aria-hidden="true" className="absolute inset-0">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_-10%,rgba(88,196,182,0.18),transparent_45%),radial-gradient(circle_at_90%_0%,rgba(125,224,211,0.1),transparent_40%)]" />
            <div className="absolute -right-32 -top-24 h-[28rem] w-[28rem] rounded-full bg-[var(--accent-soft)] blur-3xl" />
          </div>

          <div className="relative mx-auto grid w-full max-w-6xl items-center gap-14 px-5 pb-20 pt-16 sm:px-6 sm:pt-24 lg:grid-cols-[1.05fr_0.95fr] lg:gap-12 lg:pb-28">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-[var(--accent-soft-strong)] bg-[var(--accent-soft)] px-4 py-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]" aria-hidden="true" />
                <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--accent-text)]">
                  {isSpanish ? "Sistema financiero para hosts" : "Financial system for hosts"}
                </span>
              </div>

              <h1 className="mt-6 text-balance text-4xl font-bold leading-[1.07] tracking-tight text-white sm:text-5xl lg:text-6xl">
                {isSpanish ? (
                  <>
                    ¿Cuánto te queda <span className="text-[var(--accent)]">de verdad</span> de tu Airbnb?
                  </>
                ) : (
                  <>
                    What does your Airbnb <span className="text-[var(--accent)]">actually</span> leave you?
                  </>
                )}
              </h1>

              <p className="mt-6 max-w-xl text-pretty text-lg leading-relaxed text-slate-300">
                {isSpanish
                  ? "Deja de mirar ingresos. GoHostlyx convierte reservas, gastos e impuestos en una sola cifra: tu beneficio real."
                  : "Stop staring at revenue. GoHostlyx turns bookings, expenses, and taxes into one number: your real profit."}
              </p>

              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                <Link
                  href={dashboardHref}
                  className="brand-button inline-flex items-center justify-center gap-2 rounded-2xl px-7 py-3.5 text-base font-semibold transition"
                >
                  {isSpanish ? "Empieza gratis" : "Start free"}
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
                <Link
                  href="#preview"
                  className="brand-button-secondary inline-flex items-center justify-center gap-2 rounded-2xl px-7 py-3.5 text-base font-semibold transition"
                >
                  {isSpanish ? "Ver cómo funciona" : "See how it works"}
                </Link>
              </div>

              <div className="mt-10 flex items-center gap-4">
                <div className="flex -space-x-2">
                  {hostInitials.map((initials) => (
                    <span
                      key={initials}
                      aria-hidden="true"
                      className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-[var(--background)] bg-[linear-gradient(180deg,rgba(88,196,182,0.32)_0%,rgba(12,23,39,0.92)_100%)] text-[10px] font-semibold tracking-[0.1em] text-slate-100"
                    >
                      {initials}
                    </span>
                  ))}
                </div>
                <p className="text-sm text-slate-400">
                  {isSpanish ? "Usado por más de 200 hosts en España" : "Used by 200+ hosts in Spain"}
                </p>
              </div>
            </div>

            <div className="lg:pl-4">
              <ProfitPreview isSpanish={isSpanish} />
            </div>
          </div>
        </section>

        <section className="mx-auto w-full max-w-6xl px-5 py-20 sm:px-6 sm:py-24">
          <div className="max-w-2xl">
            <Eyebrow>{isSpanish ? "El problema" : "The problem"}</Eyebrow>
            <h2 className="mt-4 text-balance text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              {isSpanish ? "No te falta facturación. Te falta claridad." : "It is not revenue you lack. It is clarity."}
            </h2>
          </div>

          <div className="mt-12 grid gap-4 sm:grid-cols-3">
            {valueProps.map((prop) => {
              const Icon = prop.icon;
              return (
                <article
                  key={prop.title}
                  className="rounded-3xl border border-white/[0.08] bg-white/[0.025] p-6"
                >
                  <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[var(--accent-soft-strong)] bg-[var(--accent-soft)]">
                    <Icon className="h-5 w-5 text-[var(--accent-text)]" aria-hidden="true" />
                  </span>
                  <h3 className="mt-5 text-lg font-semibold text-white">{prop.title}</h3>
                  <p className="mt-2 text-sm leading-7 text-slate-400">{prop.description}</p>
                </article>
              );
            })}
          </div>
        </section>

        <section id="preview" className="relative overflow-hidden py-20 sm:py-24">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute left-1/2 top-1/2 h-[420px] w-[720px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--accent-soft)] opacity-60 blur-3xl"
          />
          <div className="relative mx-auto w-full max-w-6xl px-5 sm:px-6">
            <div className="mx-auto max-w-2xl text-center">
              <Eyebrow>{isSpanish ? "La solución" : "The solution"}</Eyebrow>
              <h2 className="mt-4 text-balance text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                {isSpanish ? "Lo único que importa: lo que te quedas" : "The only thing that matters: what you keep"}
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-pretty text-lg leading-8 text-slate-300">
                {isSpanish
                  ? "Sube tu Excel y en minutos ves tu beneficio real, tus gastos y por qué tu dinero no siempre coincide."
                  : "Upload your Excel and in minutes see your real profit, your expenses, and why your money never quite matches."}
              </p>
            </div>

            <div className="mx-auto mt-12 max-w-3xl overflow-hidden rounded-[28px] border border-white/[0.08] bg-[linear-gradient(180deg,rgba(17,28,44,0.7)_0%,rgba(11,22,37,0.85)_100%)] shadow-[0_30px_80px_rgba(2,6,23,0.35)]">
              <div className="flex items-center gap-2 border-b border-white/[0.06] px-4 py-3">
                <span className="flex gap-1.5" aria-hidden="true">
                  <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
                  <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
                  <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
                </span>
                <span className="mx-auto rounded-lg bg-white/[0.05] px-4 py-1 text-xs text-slate-400">
                  gohostlyx.vercel.app/dashboard
                </span>
              </div>
              <div className="p-4 sm:p-6">
                <ProfitPreview isSpanish={isSpanish} />
              </div>
            </div>
          </div>
        </section>

        <section id="features" className="mx-auto w-full max-w-6xl px-5 py-20 sm:px-6 sm:py-24">
          <div className="max-w-2xl">
            <Eyebrow>{isSpanish ? "Funcionalidades" : "Features"}</Eyebrow>
            <h2 className="mt-4 text-balance text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              {isSpanish ? "Todo para entender tu negocio en un sitio" : "Everything to understand your business, in one place"}
            </h2>
          </div>

          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => {
              const Icon = feature.icon;
              return (
                <article
                  key={feature.title}
                  className="group rounded-3xl border border-white/[0.08] bg-white/[0.025] p-6 transition-colors hover:border-[var(--accent-soft-strong)]"
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--accent-soft-strong)] bg-[var(--accent-soft)] transition-colors group-hover:bg-[rgba(88,196,182,0.22)]">
                    <Icon className="h-4 w-4 text-[var(--accent-text)]" aria-hidden="true" />
                  </span>
                  <h3 className="mt-5 text-base font-semibold text-white">{feature.title}</h3>
                  <p className="mt-2 text-sm leading-7 text-slate-400">{feature.description}</p>
                </article>
              );
            })}
          </div>
        </section>

        <section id="pricing" className="mx-auto w-full max-w-6xl px-5 py-20 sm:px-6 sm:py-24">
          <div className="mx-auto max-w-2xl text-center">
            <Eyebrow>{isSpanish ? "Precios" : "Pricing"}</Eyebrow>
            <h2 className="mt-4 text-balance text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              {isSpanish ? "Simple y transparente" : "Simple and transparent"}
            </h2>
            <p className="mx-auto mt-4 max-w-md text-lg leading-8 text-slate-300">
              {isSpanish ? "Elige el plan que encaja con tu negocio. Cancela cuando quieras." : "Pick the plan that fits your business. Cancel anytime."}
            </p>
          </div>

          <div className="mt-12 grid items-start gap-5 lg:grid-cols-3">
            {pricingPlans.map((plan) => (
              <article
                key={plan.name}
                className={`relative flex flex-col rounded-3xl border p-7 ${
                  plan.highlighted
                    ? "border-[var(--accent)]/40 bg-[rgba(88,196,182,0.07)] lg:-mt-3 lg:pb-9"
                    : "border-white/[0.08] bg-white/[0.025]"
                }`}
              >
                {plan.badge ? (
                  <span className="absolute -top-3 left-7 rounded-full bg-[var(--accent)] px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--accent-contrast)]">
                    {plan.badge}
                  </span>
                ) : null}

                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--accent-text)]">{plan.name}</p>
                <p className="mt-1 text-sm text-slate-400">{plan.tagline}</p>

                <div className="mt-5 flex items-end gap-1">
                  <span className="font-mono text-4xl font-semibold tracking-tight text-white">€{plan.price}</span>
                  <span className="mb-1 text-sm text-slate-400">{isSpanish ? "/mes" : "/mo"}</span>
                </div>

                <p className="mt-4 text-sm leading-7 text-slate-400">{plan.description}</p>

                <ul className="mt-6 mb-8 space-y-3">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-center gap-3">
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-[var(--accent)]" aria-hidden="true" />
                      <span className="text-sm text-slate-300">{feature}</span>
                    </li>
                  ))}
                </ul>

                <Link
                  href={dashboardHref}
                  className={`mt-auto inline-flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                    plan.highlighted
                      ? "brand-button"
                      : "border border-white/10 bg-white/[0.04] text-slate-100 hover:bg-white/[0.08]"
                  }`}
                >
                  {isSpanish ? "Empezar" : "Get started"}
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </article>
            ))}
          </div>
        </section>

        <section className="mx-auto w-full max-w-6xl px-5 pb-24 pt-4 sm:px-6">
          <div className="relative overflow-hidden rounded-[32px] border border-white/[0.08] bg-[linear-gradient(135deg,rgba(88,196,182,0.14)_0%,rgba(17,28,44,0.9)_45%,rgba(11,22,37,0.95)_100%)] px-6 py-14 text-center sm:px-16 sm:py-20">
            <div aria-hidden="true" className="pointer-events-none absolute -right-10 -top-10 h-72 w-72 rounded-full bg-[var(--accent-soft)] blur-3xl" />
            <div className="relative">
              <h2 className="mx-auto max-w-2xl text-balance text-3xl font-semibold tracking-tight text-white sm:text-4xl lg:text-5xl">
                {isSpanish ? "Empieza con tus datos. Quédate con la claridad." : "Start with your data. Keep the clarity."}
              </h2>
              <p className="mx-auto mt-5 max-w-lg text-lg leading-8 text-slate-300">
                {isSpanish
                  ? "Sube tu Excel y descubre en minutos cuánto estás ganando realmente."
                  : "Upload your Excel and discover in minutes how much you are really making."}
              </p>

              <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
                <Link
                  href={dashboardHref}
                  className="brand-button inline-flex items-center justify-center gap-2 rounded-2xl px-8 py-3.5 text-base font-semibold transition"
                >
                  <Upload className="h-4 w-4" aria-hidden="true" />
                  {isSpanish ? "Sube tus datos" : "Upload your data"}
                </Link>
                <Link
                  href="/pricing"
                  className="brand-button-secondary inline-flex items-center justify-center rounded-2xl px-8 py-3.5 text-base font-semibold transition"
                >
                  {isSpanish ? "Ver precios" : "See pricing"}
                </Link>
              </div>

              <div className="mt-9 flex flex-wrap justify-center gap-x-7 gap-y-3 text-sm text-slate-400">
                {ctaBullets.map((item) => (
                  <span key={item} className="flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-[var(--accent)]" aria-hidden="true" />
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
