import { formatCurrency, formatDateLabel, formatNumber, formatPercent } from "@/lib/format";
import type { DashboardView } from "@/lib/types";

function ShareMetricCard({
  label,
  value,
  helper,
  emphasis = false,
}: {
  label: string;
  value: string;
  helper: string;
  emphasis?: boolean;
}) {
  return (
    <article
      className={`report-metric-card rounded-[24px] border px-5 py-5 ${
        emphasis
          ? "report-metric-card--primary border-emerald-200 bg-[linear-gradient(180deg,rgba(236,253,245,0.95)_0%,rgba(240,249,255,0.96)_100%)]"
          : "border-slate-200 bg-white"
      }`}
    >
      <p className="report-metric-label text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
        {label}
      </p>
      <p
        className={`report-metric-value mt-4 font-semibold tracking-[-0.05em] ${
          emphasis ? "text-5xl text-slate-950 sm:text-6xl" : "text-3xl text-slate-900"
        }`}
      >
        {value}
      </p>
      <p className={`report-metric-helper mt-3 text-sm leading-6 ${emphasis ? "max-w-xl text-slate-600" : "text-slate-500"}`}>
        {helper}
      </p>
    </article>
  );
}

export function ShareReportSheet({
  businessName,
  view,
  generatedAt,
  latestImportFileName,
}: {
  businessName: string;
  view: DashboardView;
  generatedAt: string;
  latestImportFileName?: string | null;
}) {
  const topExpenseCategories = view.expensesByCategory.slice(0, 4);
  const totalExpenses = view.expensesByCategory.reduce((sum, item) => sum + item.value, 0);

  if (view.mixedCurrencyMode) {
    return (
      <section className="report-sheet mx-auto max-w-5xl rounded-[32px] border border-slate-200 bg-white p-8 shadow-[0_18px_46px_rgba(15,23,42,0.08)] sm:p-10">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
          Share Report
        </p>
        <h1 className="mt-4 text-4xl font-semibold tracking-[-0.06em] text-slate-950">
          Select one market before exporting.
        </h1>
        <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-600">
          This report is meant to be client-ready. Hostlyx will not export a single summary when the
          current view mixes several currencies.
        </p>
      </section>
    );
  }

  return (
    <section className="report-sheet mx-auto max-w-5xl rounded-[32px] border border-slate-200 bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(248,250,252,0.98)_100%)] p-8 shadow-[0_18px_46px_rgba(15,23,42,0.08)] sm:p-10">
      <div className="report-sheet-header flex flex-col gap-6 border-b border-slate-200 pb-8 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
              Hostlyx Financial Summary
            </p>
            <h1 className="mt-4 text-4xl font-semibold tracking-[-0.06em] text-slate-950 sm:text-5xl">
              {businessName}
            </h1>
          </div>
          <p className="max-w-2xl text-sm leading-7 text-slate-600">
            A clean snapshot of revenue, costs, profit, and what the business keeps after estimated taxes.
            Prepared for accountant, partner, or investor review.
          </p>
        </div>

        <div className="report-sheet-meta grid gap-4 sm:min-w-[260px]">
          <div className="report-meta-card rounded-[20px] border border-slate-200 bg-white px-4 py-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              Reporting period
            </p>
            <p className="mt-2 text-base font-semibold text-slate-900">{view.rangeLabel}</p>
          </div>
          <div className="report-meta-card rounded-[20px] border border-slate-200 bg-white px-4 py-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              Generated
            </p>
            <p className="mt-2 text-base font-semibold text-slate-900">{generatedAt}</p>
          </div>
          {latestImportFileName ? (
            <div className="report-meta-card rounded-[20px] border border-slate-200 bg-white px-4 py-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                Source file
              </p>
              <p className="mt-2 text-sm font-medium text-slate-700">{latestImportFileName}</p>
            </div>
          ) : null}
        </div>
      </div>

      <div className="report-sheet-summary mt-8 grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(250px,0.7fr)]">
        <ShareMetricCard
          label="You Keep"
          value={formatCurrency(view.metrics.profitAfterTax, false, view.displayCurrencyCode)}
          helper="This is roughly what remains after setting aside estimated taxes."
          emphasis
        />

        <div className="report-sheet-summary-aside grid gap-4">
          <ShareMetricCard
            label="Set Aside"
            value={formatCurrency(view.metrics.estimatedTaxes, false, view.displayCurrencyCode)}
            helper="Estimated tax reserve for the current reporting view."
          />
          <ShareMetricCard
            label="Net Profit"
            value={formatCurrency(view.metrics.netProfit, false, view.displayCurrencyCode)}
            helper="Profit before taxes are set aside."
          />
        </div>
      </div>

      <div className="report-sheet-metrics mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <ShareMetricCard
          label="Revenue"
          value={formatCurrency(view.metrics.totalRevenue, false, view.displayCurrencyCode)}
          helper="Total gross revenue in the selected view."
        />
        <ShareMetricCard
          label="Expenses"
          value={formatCurrency(view.metrics.totalExpenses, false, view.displayCurrencyCode)}
          helper="Operating expenses recorded for the same period."
        />
        <ShareMetricCard
          label="Bookings"
          value={formatNumber(view.metrics.bookingsCount)}
          helper="Completed and imported stays included here."
        />
        <ShareMetricCard
          label="Profit Margin"
          value={formatPercent(view.metrics.profitMargin)}
          helper="Share of revenue that reached profit before tax."
        />
      </div>

      <div className="report-sheet-details mt-8 grid gap-6 xl:grid-cols-2">
        <article className="report-detail-card rounded-[24px] border border-slate-200 bg-white px-5 py-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            Revenue by channel
          </p>
          <div className="mt-5 space-y-3">
            {view.revenueByChannel.slice(0, 4).map((channel) => (
              <div key={channel.label} className="flex items-start justify-between gap-4 border-b border-slate-100 pb-3 last:border-b-0 last:pb-0">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{channel.label}</p>
                  <p className="mt-1 text-sm text-slate-500">
                    {formatNumber(channel.bookings)} bookings
                  </p>
                </div>
                <p className="text-sm font-semibold text-slate-900">
                  {formatCurrency(channel.revenue, false, view.displayCurrencyCode)}
                </p>
              </div>
            ))}
          </div>
        </article>

        <article className="report-detail-card rounded-[24px] border border-slate-200 bg-white px-5 py-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            Expense structure
          </p>
          <div className="mt-5 space-y-3">
            {topExpenseCategories.map((item) => {
              const share = totalExpenses > 0 ? item.value / totalExpenses : 0;

              return (
                <div key={item.label} className="flex items-start justify-between gap-4 border-b border-slate-100 pb-3 last:border-b-0 last:pb-0">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{item.label}</p>
                    <p className="mt-1 text-sm text-slate-500">
                      {formatPercent(share)} of total expenses
                    </p>
                  </div>
                  <p className="text-sm font-semibold text-slate-900">
                    {formatCurrency(item.value, false, view.displayCurrencyCode)}
                  </p>
                </div>
              );
            })}
          </div>
        </article>
      </div>

      <div className="report-sheet-footer mt-8 border-t border-slate-200 pt-5 text-sm text-slate-500">
        Report generated by Hostlyx from imported bookings and expenses.
        {latestImportFileName ? ` Latest source: ${latestImportFileName}.` : ""}
        {view.monthlySummary[0]?.label ? ` Period covered includes ${view.monthlySummary[0].label} to ${view.monthlySummary.at(-1)?.label}.` : ""}
      </div>
    </section>
  );
}
