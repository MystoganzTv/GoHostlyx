type MarketingDashboardPreviewProps = {
  compact?: boolean;
  variant?: "profit" | "feature" | "value";
};

const monthlyBars = [
  { label: "Jan", height: 34 },
  { label: "Feb", height: 46 },
  { label: "Mar", height: 58 },
  { label: "Apr", height: 67 },
  { label: "May", height: 61 },
  { label: "Jun", height: 82 },
];

const expenses = [
  { label: "Host fee", value: "€8.7K", width: "71%" },
  { label: "Cleaning", value: "€6.2K", width: "52%" },
  { label: "Utilities", value: "€4.1K", width: "34%" },
  { label: "Repairs", value: "€2.8K", width: "24%" },
];

export function MarketingDashboardPreview({
  compact = false,
  variant = "profit",
}: MarketingDashboardPreviewProps) {
  const sidebarItems =
    variant === "value"
      ? ["Dashboard", "Performance", "Reports", "Imports", "Settings"]
      : ["Dashboard", "Bookings", "Expenses", "Performance", "Reports"];

  const topBadge =
    variant === "feature"
      ? { label: "Operator clarity", className: "bg-cyan-400/12 text-cyan-100" }
      : variant === "value"
        ? { label: "Worth paying for", className: "bg-indigo-400/14 text-indigo-100" }
        : { label: "Profit first", className: "bg-emerald-400/14 text-emerald-200" };

  const previewTitle =
    variant === "feature"
      ? "Operator workflow"
      : variant === "value"
        ? "Business value"
        : "Financial overview";

  const chartTitle =
    variant === "feature"
      ? "Business performance"
      : variant === "value"
        ? "Return on visibility"
        : "Profit over time";

  const chartSubtitle =
    variant === "feature"
      ? "Signals that help operators act fast"
      : variant === "value"
        ? "What better financial decisions compound into"
        : "How the business is performing";

  const bookingsBlockTitle =
    variant === "feature"
      ? "Operational detail"
      : variant === "value"
        ? "Owner-ready view"
        : "Recent bookings";

  const moneySignalsTitle =
    variant === "value" ? "Why hosts pay" : "Money signals";

  const moneySignalItems =
    variant === "value"
      ? [
          ["Time saved", "12h/mo"],
          ["Margin clarity", "20.6%"],
          ["Decision speed", "Faster"],
        ]
      : [
          ["ADR", "€212"],
          ["Occupancy", "73.8%"],
          ["RevPAR", "€156"],
        ];

  return (
    <div className={`marketing-dashboard-preview relative overflow-hidden rounded-[30px] ${compact ? "p-4 sm:p-5" : "p-5 sm:p-6"}`}>
      <div className="grid gap-4 lg:grid-cols-[188px_1fr]">
        <div className="rounded-[24px] bg-[linear-gradient(180deg,rgba(9,18,31,0.96)_0%,rgba(7,15,25,0.94)_100%)] p-4 shadow-[0_18px_38px_rgba(2,6,23,0.24)]">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-[16px] bg-[linear-gradient(180deg,rgba(88,196,182,0.22)_0%,rgba(9,18,31,0.98)_100%)] text-sm font-semibold text-[var(--accent-text)] ring-1 ring-[var(--accent-soft-strong)]">
              H
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Hostlyx</p>
              <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Profit OS</p>
            </div>
          </div>

          <div className="mt-6 space-y-2">
            {sidebarItems.map((item, index) => (
              <div
                key={item}
                className={`rounded-2xl px-4 py-3 text-sm font-medium ${
                  index === 0
                    ? "bg-[var(--workspace-sidebar-active)] text-white shadow-[0_14px_28px_rgba(4,8,18,0.18)]"
                    : "text-slate-400"
                }`}
              >
                {item}
              </div>
            ))}
          </div>

          <div className="mt-6 rounded-[20px] bg-white/[0.04] p-4">
            <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">This month</p>
            <p className="mt-3 text-2xl font-semibold text-white">€9,654</p>
            <p className="mt-2 text-xs text-emerald-200">
              {variant === "value" ? "Clear value, every month" : "Net profit is positive"}
            </p>
          </div>
        </div>

        <div className="rounded-[24px] bg-[linear-gradient(180deg,rgba(13,25,42,0.98)_0%,rgba(8,16,28,0.95)_100%)] p-4 sm:p-5 shadow-[0_22px_48px_rgba(2,6,23,0.24)]">
          <div className="flex flex-col gap-4 border-b border-white/8 pb-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Financial command center</p>
              <span
                className={`mt-3 inline-flex rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${topBadge.className}`}
              >
                {topBadge.label}
              </span>
              <p className="mt-2 text-2xl font-semibold tracking-tight text-white">{previewTitle}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {["2026", "All months", "Airbnb + Booking"].map((item) => (
                <span
                  key={item}
                  className="rounded-full border border-white/8 bg-white/[0.04] px-3 py-2 text-xs font-medium text-slate-300"
                >
                  {item}
                </span>
              ))}
            </div>
          </div>

          <div className={`mt-5 grid gap-3 ${compact ? "md:grid-cols-2 xl:grid-cols-4" : "md:grid-cols-[1.3fr_1fr_1fr_1fr]"}`}>
            <div className="rounded-[22px] bg-[linear-gradient(180deg,rgba(29,78,60,0.28)_0%,rgba(11,29,24,0.88)_100%)] p-5 ring-1 ring-emerald-300/18">
              <p className="text-[11px] uppercase tracking-[0.18em] text-emerald-100/80">Net Profit</p>
              <p className="mt-4 text-4xl font-semibold tracking-tight text-white">€9,654</p>
              <p className="mt-2 text-xs text-emerald-100/80">
                {variant === "feature" ? "The number operators check first" : variant === "value" ? "A number worth paying to understand" : "Most important number"}
              </p>
            </div>
            <div className="rounded-[22px] bg-white/[0.04] p-5">
              <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Revenue</p>
              <p className="mt-4 text-3xl font-semibold text-white">€46,857</p>
            </div>
            <div className="rounded-[22px] bg-white/[0.04] p-5">
              <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Expenses</p>
              <p className="mt-4 text-3xl font-semibold text-white">€37,203</p>
            </div>
            <div className="rounded-[22px] bg-white/[0.04] p-5">
              <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Margin</p>
              <p className="mt-4 text-3xl font-semibold text-emerald-300">20.6%</p>
            </div>
          </div>

          <div className="mt-5 grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
            <div className="rounded-[22px] bg-white/[0.04] p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-white">{chartTitle}</p>
                  <p className="mt-1 text-xs text-slate-500">{chartSubtitle}</p>
                </div>
                <span className="rounded-full bg-emerald-400/12 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-200">
                  +18%
                </span>
              </div>

              <div className="mt-6 flex items-end justify-between gap-3">
                {monthlyBars.map((item) => (
                  <div key={item.label} className="flex flex-1 flex-col items-center gap-3">
                    <div className="flex h-36 w-full items-end rounded-[18px] bg-white/[0.02] px-1.5 pb-1.5">
                      <div
                        className="w-full rounded-[14px] bg-[linear-gradient(180deg,rgba(88,196,182,0.98)_0%,rgba(43,128,116,0.96)_100%)] shadow-[0_12px_26px_rgba(88,196,182,0.16)]"
                        style={{ height: `${item.height}%` }}
                      />
                    </div>
                    <span className="text-xs text-slate-500">{item.label}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-[22px] bg-white/[0.04] p-5">
                <p className="text-sm font-semibold text-white">Revenue vs Expenses</p>
                <div className="mt-5 space-y-4">
                  <div>
                    <div className="mb-2 flex items-center justify-between text-xs text-slate-400">
                      <span>Revenue</span>
                      <span>€46.8K</span>
                    </div>
                    <div className="h-3 rounded-full bg-white/[0.05]">
                      <div className="h-3 w-[88%] rounded-full bg-[linear-gradient(90deg,#58c4b6_0%,#7de0d3_100%)]" />
                    </div>
                  </div>
                  <div>
                    <div className="mb-2 flex items-center justify-between text-xs text-slate-400">
                      <span>Expenses</span>
                      <span>€37.2K</span>
                    </div>
                    <div className="h-3 rounded-full bg-white/[0.05]">
                      <div className="h-3 w-[70%] rounded-full bg-[linear-gradient(90deg,#f09aa5_0%,#ec8f96_100%)]" />
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-[22px] bg-white/[0.04] p-5">
                <p className="text-sm font-semibold text-white">Expense breakdown</p>
                <div className="mt-5 space-y-3">
                  {expenses.map((item) => (
                    <div key={item.label}>
                      <div className="mb-2 flex items-center justify-between text-xs text-slate-400">
                        <span>{item.label}</span>
                        <span>{item.value}</span>
                      </div>
                      <div className="h-2.5 rounded-full bg-white/[0.05]">
                        <div className="h-2.5 rounded-full bg-[linear-gradient(90deg,#7a94d6_0%,#58c4b6_100%)]" style={{ width: item.width }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {!compact ? (
            <div className="mt-5 grid gap-4 xl:grid-cols-2">
              <div className="rounded-[22px] bg-white/[0.04] p-5">
                <p className="text-sm font-semibold text-white">{bookingsBlockTitle}</p>
                <div className="mt-4 space-y-3">
                  {[
                    ["John Rivera", "4 nights", "€612 payout"],
                    ["Emma Scott", "6 nights", "€924 payout"],
                  ].map(([guest, stay, payout]) => (
                    <div key={guest} className="flex items-center justify-between gap-4 rounded-[18px] bg-white/[0.03] px-4 py-3">
                      <div>
                        <p className="text-sm font-medium text-white">{guest}</p>
                        <p className="mt-1 text-xs text-slate-500">{stay}</p>
                      </div>
                      <span className="text-sm font-semibold text-slate-200">{payout}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-[22px] bg-white/[0.04] p-5">
                <p className="text-sm font-semibold text-white">{moneySignalsTitle}</p>
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  {moneySignalItems.map(([label, value]) => (
                    <div key={label} className="rounded-[18px] bg-white/[0.03] px-4 py-4">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">{label}</p>
                      <p className="mt-3 text-lg font-semibold text-white">{value}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
