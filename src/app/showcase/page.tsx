import Link from "next/link";
import {
  ArrowRight,
  CalendarRange,
  ChartNoAxesCombined,
  FileSpreadsheet,
  WalletCards,
} from "lucide-react";
import { getAuthSession } from "@/lib/auth";
import { MarketingDashboardPreview } from "@/components/marketing-dashboard-preview";
import { MarketingFooter } from "@/components/marketing-footer";
import { MarketingHeader } from "@/components/marketing-header";

const showcaseItems = [
  {
    title: "Workbook intake",
    description: "Bring history into the app when needed, skip exact duplicates, and keep imports as traceability instead of the main workflow.",
    icon: <FileSpreadsheet className="h-5 w-5" />,
  },
  {
    title: "Operational calendar",
    description: "Read bookings, guests, nights, check-ins, check-outs, and closed days without cleaning the sheet first.",
    icon: <CalendarRange className="h-5 w-5" />,
  },
  {
    title: "Performance read",
    description: "See occupancy, ADR, RevPAR, bookings, guests, and monthly performance in a dashboard that makes sense.",
    icon: <ChartNoAxesCombined className="h-5 w-5" />,
  },
  {
    title: "Account isolation",
    description: "Each operator keeps a separate workspace with its own properties, imports, settings, and financial context.",
    icon: <WalletCards className="h-5 w-5" />,
  },
];

export default async function ShowcasePage() {
  const session = await getAuthSession();
  const signedIn = Boolean(session?.user?.email);

  return (
    <>
      <MarketingHeader activePage="showcase" signedIn={signedIn} />

      <main className="mx-auto w-full max-w-7xl px-4 pb-8 pt-10 sm:px-6 xl:px-8">
        <section className="grid items-center gap-10 xl:grid-cols-[1.02fr_0.98fr]">
          <div className="max-w-3xl">
            <p className="text-xs uppercase tracking-[0.18em] text-[var(--accent-text)]/80">Showcase</p>
            <h1 className="mt-4 text-4xl font-semibold tracking-tight text-slate-100 sm:text-5xl">
              See how Hostlyx turns revenue, expenses, and profit into one clear operating layer.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-8 text-slate-300 sm:text-lg">
              This is the showroom for what buyers actually get: a better place to understand the business, not just another place to upload a file.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href={signedIn ? "/dashboard" : "/login"}
                className="brand-button inline-flex items-center gap-2 rounded-2xl px-5 py-3 text-sm font-semibold transition"
              >
                {signedIn ? "Open your workspace" : "Try Hostlyx"}
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/pricing"
                className="brand-button-secondary rounded-2xl px-5 py-3 text-sm font-semibold transition"
              >
                View pricing
              </Link>
            </div>
          </div>

          <div
            className="marketing-photo-panel min-h-[380px] rounded-[34px] p-8 sm:p-10"
            style={{
              backgroundImage:
                "url('https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1400&q=80')",
              backgroundSize: "cover",
              backgroundPosition: "center",
            }}
          >
            <div className="relative z-[1] max-w-sm">
              <p className="text-xs uppercase tracking-[0.18em] text-[var(--accent-text)]/80">
                Beautiful dashboard, real business logic
              </p>
              <p className="mt-3 text-3xl font-semibold tracking-tight text-white">
                The kind of financial view hosts wish they had from day one.
              </p>
            </div>
          </div>
        </section>

        <div className="marketing-divider my-14" />

        <section className="grid items-center gap-10 xl:grid-cols-[1.04fr_0.96fr]">
          <div className="max-w-3xl">
            <p className="text-xs uppercase tracking-[0.18em] text-[var(--accent-text)]/80">Product preview</p>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight text-slate-100 sm:text-4xl">
              The preview should feel like the actual software someone would pay for.
            </h2>
            <p className="mt-5 max-w-2xl text-base leading-8 text-slate-300">
              That means a real command-center layout, a clear `profit first` hierarchy, and financial modules that instantly explain what is working and what is not.
            </p>
          </div>

          <MarketingDashboardPreview compact variant="feature" />
        </section>

        <div className="marketing-divider my-14" />

        <section className="grid gap-8 md:grid-cols-2 xl:grid-cols-4">
          {showcaseItems.map((item) => (
            <article key={item.title}>
              <div className="brand-icon inline-flex rounded-2xl p-3">{item.icon}</div>
              <h2 className="mt-5 text-2xl font-semibold text-slate-100">{item.title}</h2>
              <p className="mt-3 text-sm leading-7 text-slate-400">{item.description}</p>
            </article>
          ))}
        </section>

        <div className="marketing-divider my-14" />

        <section className="grid items-center gap-10 xl:grid-cols-[0.98fr_1.02fr]">
          <div
            className="marketing-photo-panel min-h-[360px] rounded-[34px] p-8 sm:p-10"
            style={{
              backgroundImage:
                "url('https://images.unsplash.com/photo-1560448204-603b3fc33ddc?auto=format&fit=crop&w=1400&q=80')",
              backgroundSize: "cover",
              backgroundPosition: "center",
            }}
          >
            <div className="relative z-[1] max-w-sm">
              <p className="text-xs uppercase tracking-[0.18em] text-[var(--accent-text)]/80">
                Source of truth
              </p>
              <p className="mt-3 text-3xl font-semibold tracking-tight text-white">
                Hostlyx is where the operator should stay after import, not where they pass through.
              </p>
            </div>
          </div>

          <div className="space-y-5">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">What the app replaces</p>
            <h2 className="text-3xl font-semibold tracking-tight text-slate-100 sm:text-4xl">
              Guesswork, spreadsheet drift, and the feeling that profit is always a surprise.
            </h2>
            <p className="text-base leading-8 text-slate-300">
              The product story is simple: import once if needed, save data in the cloud, and read the business through clear views for dashboard, cashflow, performance, monthly review, bookings, and expenses.
            </p>

            <div className="marketing-panel rounded-[28px] px-6 py-6">
              <p className="text-sm leading-7 text-slate-300">
                That is the difference between a spreadsheet helper and an actual finance operating system.
              </p>
            </div>
          </div>
        </section>
      </main>

      <MarketingFooter />
    </>
  );
}
