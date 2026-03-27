import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  CircleCheckBig,
  Coins,
  CreditCard,
  LayoutDashboard,
  TrendingUp,
} from "lucide-react";
import { getAuthSession } from "@/lib/auth";
import { MarketingFooter } from "@/components/marketing-footer";
import { MarketingDashboardPreview } from "@/components/marketing-dashboard-preview";
import { MarketingHeader } from "@/components/marketing-header";
import { getServerLocale, getTranslations } from "@/lib/i18n";

const featureGroups = [
  {
    title: "Dashboard clarity",
    description: "All your key metrics at a glance — revenue, profit, expenses, and margins.",
    icon: <LayoutDashboard className="h-5 w-5" />,
  },
  {
    title: "Monthly performance",
    description: "Track how your business performs month over month with visual trends.",
    icon: <TrendingUp className="h-5 w-5" />,
  },
  {
    title: "Expense categorization",
    description: "Auto-categorize expenses: cleaning, maintenance, supplies, utilities, and more.",
    icon: <CreditCard className="h-5 w-5" />,
  },
  {
    title: "Revenue by channel",
    description: "Compare Airbnb vs Booking vs Direct. Know which channel performs best.",
    icon: <BarChart3 className="h-5 w-5" />,
  },
  {
    title: "Profit analytics",
    description: "See your real profit after all fees and expenses. No more illusions.",
    icon: <Coins className="h-5 w-5" />,
  },
  {
    title: "Cashflow tracking",
    description: "Understand when money comes in and goes out. Plan ahead with confidence.",
    icon: <CircleCheckBig className="h-5 w-5" />,
  },
];

export default async function LandingPage() {
  const session = await getAuthSession();
  const locale = await getServerLocale();
  const t = getTranslations(locale);
  const signedIn = Boolean(session?.user?.email);
  const blindSpots = [
    {
      title: t("landing.blind1Title"),
      description: t("landing.blind1Body"),
    },
    {
      title: t("landing.blind2Title"),
      description: t("landing.blind2Body"),
    },
    {
      title: t("landing.blind3Title"),
      description: t("landing.blind3Body"),
    },
  ];

  return (
    <>
      <MarketingHeader activePage="home" signedIn={signedIn} />

      <main className="mx-auto w-full max-w-7xl px-4 pb-16 pt-8 sm:px-6 lg:pt-10 xl:px-8">
        <section className="grid items-center gap-12 lg:grid-cols-[1.02fr_0.98fr] lg:gap-16">
          <div className="max-w-3xl">
            <p className="text-xs uppercase tracking-[0.22em] text-[var(--accent-text)]/78">
              {t("landing.eyebrow")}
            </p>
            <h1 className="mt-6 max-w-3xl text-5xl font-semibold tracking-[-0.06em] text-slate-100 sm:text-6xl lg:text-7xl">
              {t("landing.heroTitle")}
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">
              {t("landing.heroBody")}
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href={signedIn ? "/dashboard" : "/login"}
                className="brand-button inline-flex items-center gap-2 rounded-2xl px-5 py-3.5 text-sm font-semibold transition"
              >
                {t("landing.ctaUpload")}
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/showcase"
                className="brand-button-secondary rounded-2xl px-5 py-3.5 text-sm font-semibold transition"
              >
                {t("landing.ctaPreview")}
              </Link>
            </div>

            <div className="mt-10 grid gap-4 sm:grid-cols-3">
              {blindSpots.map((item) => (
                <div key={item.title} className="space-y-3">
                  <p className="text-sm font-semibold text-slate-100">{item.title}</p>
                  <p className="text-sm leading-7 text-slate-400">{item.description}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="relative">
            <div
              className="marketing-photo-panel min-h-[260px] rounded-[34px] p-8 sm:min-h-[320px] sm:p-10"
              style={{
                backgroundImage:
                  "url('https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1600&q=80')",
                backgroundPosition: "center",
                backgroundSize: "cover",
              }}
            >
              <div className="relative z-[1] max-w-md">
                <p className="text-xs uppercase tracking-[0.18em] text-[var(--accent-text)]/80">
                  {t("landing.blind3Title")}
                </p>
                <h2 className="mt-4 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                  Spreadsheets were never built for rental businesses.
                </h2>
                <p className="mt-4 text-sm leading-7 text-slate-200/90">
                  You need a system that shows the full picture: revenue,
                  expenses, performance, and actual profit.
                </p>
              </div>
            </div>

            <div className="relative -mt-10 px-4 sm:-mt-14 sm:px-8">
              <MarketingDashboardPreview variant="profit" />
            </div>
          </div>
        </section>

        <section className="mt-20 grid gap-12 lg:grid-cols-[0.92fr_1.08fr] lg:items-center">
          <div className="max-w-xl">
            <p className="text-xs uppercase tracking-[0.18em] text-[var(--accent-text)]/78">
              One place to understand your rental business
            </p>
            <h2 className="mt-5 text-3xl font-semibold tracking-[-0.05em] text-slate-100 sm:text-5xl">
              Hostlyx brings bookings, expenses, and profit into one clear system.
            </h2>
            <p className="mt-5 text-base leading-8 text-slate-300">
              Import from Airbnb, Booking, or your existing Excel workflow.
              Then keep working inside Hostlyx, where your financial story is
              finally readable.
            </p>
          </div>

          <div className="grid gap-8 sm:grid-cols-2">
            <div className="space-y-4">
              <div className="brand-icon inline-flex rounded-2xl p-3">
                <CircleCheckBig className="h-5 w-5" />
              </div>
              <h3 className="text-2xl font-semibold text-slate-100">
                Imports with context
              </h3>
              <p className="text-sm leading-7 text-slate-400">
                Import from Airbnb, Booking, or any spreadsheet format you
                already use and see every reservation with full financial detail.
              </p>
            </div>

            <div className="space-y-4">
              <div className="brand-icon inline-flex rounded-2xl p-3">
                <CreditCard className="h-5 w-5" />
              </div>
              <h3 className="text-2xl font-semibold text-slate-100">
                Expense visibility
              </h3>
              <p className="text-sm leading-7 text-slate-400">
                Categorize every cost: cleaning, maintenance, supplies,
                utilities, fees, and repairs. Know exactly where money goes.
              </p>
            </div>

            <div className="space-y-4">
              <div className="brand-icon inline-flex rounded-2xl p-3">
                <Coins className="h-5 w-5" />
              </div>
              <h3 className="text-2xl font-semibold text-slate-100">
                Real profit, not illusion
              </h3>
              <p className="text-sm leading-7 text-slate-400">
                Revenue minus fees minus expenses equals your actual profit. No
                more guessing and no more surprises at the end of the year.
              </p>
            </div>

            <div className="space-y-4">
              <div className="brand-icon inline-flex rounded-2xl p-3">
                <BarChart3 className="h-5 w-5" />
              </div>
              <h3 className="text-2xl font-semibold text-slate-100">
                KPIs that matter
              </h3>
              <p className="text-sm leading-7 text-slate-400">
                Occupancy rate, ADR, RevPAR, bookings, margin, and cashflow.
                The metrics that matter, updated in one place.
              </p>
            </div>
          </div>
        </section>

        <section className="mt-20">
          <div className="max-w-2xl">
            <p className="text-xs uppercase tracking-[0.18em] text-[var(--accent-text)]/78">
              Everything you need to run a profitable rental
            </p>
            <h2 className="mt-5 text-3xl font-semibold tracking-[-0.05em] text-slate-100 sm:text-5xl">
              A dashboard that makes sense.
            </h2>
            <p className="mt-5 text-base leading-8 text-slate-300">
              No more spreadsheets. No more guessing. Just clear, actionable
              financial data for a real rental business.
            </p>
          </div>

          <div className="mt-10 grid gap-x-10 gap-y-12 md:grid-cols-2 xl:grid-cols-3">
            {featureGroups.map((item) => (
              <article key={item.title} className="max-w-sm">
                <div className="brand-icon inline-flex rounded-2xl p-3">
                  {item.icon}
                </div>
                <h3 className="mt-5 text-2xl font-semibold text-slate-100">
                  {item.title}
                </h3>
                <p className="mt-3 text-sm leading-7 text-slate-400">
                  {item.description}
                </p>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-20 grid gap-10 lg:grid-cols-[0.96fr_1.04fr] lg:items-center">
          <div
            className="marketing-photo-panel min-h-[320px] rounded-[36px] p-8 sm:min-h-[380px] sm:p-10"
            style={{
              backgroundImage:
                "url('https://images.unsplash.com/photo-1560448204-603b3fc33ddc?auto=format&fit=crop&w=1600&q=80')",
              backgroundPosition: "center",
              backgroundSize: "cover",
            }}
          >
            <div className="relative z-[1] max-w-sm">
              <p className="text-xs uppercase tracking-[0.18em] text-[var(--accent-text)]/80">
                Hostlyx
              </p>
              <p className="mt-4 text-3xl font-semibold tracking-tight text-white">
                Join hosts who want financial clarity without living in Excel.
              </p>
            </div>
          </div>

          <div className="max-w-2xl">
            <h2 className="text-3xl font-semibold tracking-[-0.05em] text-slate-100 sm:text-5xl">
              Start with your data. Stay for the clarity.
            </h2>
            <p className="mt-5 text-base leading-8 text-slate-300">
              Hostlyx replaces spreadsheet drift with a real financial command
              center for short-term rental businesses.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href={signedIn ? "/dashboard" : "/login"}
                className="brand-button inline-flex items-center gap-2 rounded-2xl px-5 py-3.5 text-sm font-semibold transition"
              >
                {signedIn ? "Open your workspace" : "Upload your data"}
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/pricing"
                className="brand-button-secondary rounded-2xl px-5 py-3.5 text-sm font-semibold transition"
              >
                See pricing
              </Link>
            </div>
          </div>
        </section>
      </main>

      <MarketingFooter />
    </>
  );
}
