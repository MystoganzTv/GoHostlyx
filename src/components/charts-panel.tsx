"use client";

import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { CategoryPoint, ChannelPoint, CurrencyCode, MonthlyPoint } from "@/lib/types";
import { formatCurrency, formatPercent } from "@/lib/format";
import { getLocaleForCurrency } from "@/lib/markets";
import { SectionCard } from "./section-card";

const categoryColors = ["#58c4b6", "#82d3c8", "#7a94d6", "#f2b26b", "#ec8f96", "#8d81d9"];

function compactCurrency(value: number, currencyCode: CurrencyCode) {
  return new Intl.NumberFormat(getLocaleForCurrency(currencyCode), {
    notation: "compact",
    compactDisplay: "short",
    style: "currency",
    currency: currencyCode,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatTooltipValue(
  value: string | number | readonly (string | number)[] | undefined,
  currencyCode: CurrencyCode,
) {
  const normalized = Array.isArray(value) ? value[0] : value;
  return formatCurrency(Number(normalized ?? 0), true, currencyCode);
}

function EmptyChartState({ label }: { label: string }) {
  return (
    <div className="workspace-soft-card flex h-[280px] items-center justify-center rounded-[22px] border-dashed text-sm text-[var(--workspace-muted)]">
      {label}
    </div>
  );
}

function topCostShare(expensesByCategory: CategoryPoint[]) {
  const total = expensesByCategory.reduce((sum, item) => sum + item.value, 0);
  return expensesByCategory.map((item) => ({
    ...item,
    share: total > 0 ? item.value / total : 0,
  }));
}

function buildBarsLabel(month: MonthlyPoint, index: number, months: MonthlyPoint[]) {
  const currentKey = month.key ?? month.label;
  const currentYear = currentKey.slice(0, 4);
  const previousYear = index > 0 ? (months[index - 1]?.key ?? months[index - 1]?.label).slice(0, 4) : null;
  const baseMonth = month.label.slice(0, 3);

  return previousYear !== currentYear ? `${baseMonth} '${currentYear.slice(2)}` : baseMonth;
}

export function ChartsPanel({
  monthlySummary,
  expensesByCategory,
  revenueByChannel,
  currencyCode,
  mixedCurrencyMode = false,
}: {
  monthlySummary: MonthlyPoint[];
  expensesByCategory: CategoryPoint[];
  revenueByChannel: ChannelPoint[];
  currencyCode: CurrencyCode;
  mixedCurrencyMode?: boolean;
}) {
  const [profitChartMode, setProfitChartMode] = useState<"trend" | "bars">("trend");
  const [activeProfitBarKey, setActiveProfitBarKey] = useState<string | null>(null);
  const costStructure = topCostShare(expensesByCategory);
  const barsSummary = useMemo(() => monthlySummary.slice(-12), [monthlySummary]);
  const revenueExpenseSummary = useMemo(() => monthlySummary.slice(-12), [monthlySummary]);
  const largestProfitMagnitude = Math.max(
    ...barsSummary.map((month) => Math.abs(month.profit)),
    1,
  );

  if (mixedCurrencyMode) {
    return (
      <SectionCard
        title="Portfolio View"
        subtitle="All markets mixes real currencies, so Hostlyx pauses converted amount charts until you focus on one market."
      >
        <EmptyChartState label="Select a single market to unlock profit-over-time, revenue-vs-expenses, and cost charts." />
      </SectionCard>
    );
  }

  return (
    <div className="space-y-6">
      <SectionCard
        title="Profit Over Time"
        subtitle="The fastest way to see if the business is actually becoming more profitable."
        action={
          monthlySummary.length > 0 ? (
            <div className="inline-flex rounded-2xl border border-white/8 bg-white/[0.03] p-1">
              {[
                { value: "trend", label: "Trend" },
                { value: "bars", label: "Bars" },
              ].map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setProfitChartMode(option.value as "trend" | "bars")}
                  className={`rounded-xl px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] transition ${
                    profitChartMode === option.value
                      ? "bg-[var(--workspace-accent-soft)] text-[var(--workspace-text)]"
                      : "text-[var(--workspace-muted)] hover:text-[var(--workspace-text)]"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          ) : null
        }
      >
        {monthlySummary.length === 0 ? (
          <EmptyChartState label="No monthly data available for the current filters." />
        ) : profitChartMode === "trend" ? (
          <div className="h-[320px] min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthlySummary}>
                <defs>
                  <linearGradient id="profit-fill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#58c4b6" stopOpacity={0.55} />
                    <stop offset="95%" stopColor="#58c4b6" stopOpacity={0.04} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
                <XAxis dataKey="label" tick={{ fill: "#93a4bf", fontSize: 12 }} tickLine={false} axisLine={false} />
                <YAxis
                  tickFormatter={(value) => compactCurrency(value, currencyCode)}
                  tick={{ fill: "#93a4bf", fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                  width={72}
                />
                <Tooltip
                  formatter={(value) => formatTooltipValue(value, currencyCode)}
                  contentStyle={{
                    borderRadius: 18,
                    border: "1px solid rgba(255,255,255,0.08)",
                    background: "#101c2e",
                    color: "#e7edf5",
                  }}
                />
                <Area type="monotone" dataKey="profit" stroke="#58c4b6" strokeWidth={3} fill="url(#profit-fill)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="overflow-x-auto pb-2">
            <div className="flex min-w-max items-end gap-3 px-1">
            {barsSummary.map((month, index) => {
              const barHeight = `${Math.max((Math.abs(month.profit) / largestProfitMagnitude) * 68, 14)}%`;
              const isPositive = month.profit >= 0;
              const isActive = activeProfitBarKey === (month.key ?? month.label);

              return (
                <div
                  key={`profit-pill-${month.key ?? month.label}`}
                  className="flex w-[54px] shrink-0 flex-col items-center gap-2"
                >
                  <div
                    className="flex h-[118px] w-[36px] items-end rounded-[16px] bg-white/[0.03] p-1.5 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.03)]"
                    onMouseEnter={() => setActiveProfitBarKey(month.key ?? month.label)}
                    onMouseLeave={() => setActiveProfitBarKey((current) => (current === (month.key ?? month.label) ? null : current))}
                  >
                    <div
                      className={`w-full rounded-[14px] shadow-[0_12px_22px_rgba(2,6,23,0.2)] ${
                        isPositive
                          ? "bg-[linear-gradient(180deg,#67d4c7_0%,#2f8f84_100%)]"
                          : "bg-[linear-gradient(180deg,#f2a6ae_0%,#c66474_100%)]"
                      }`}
                      style={{ height: barHeight }}
                      title={`${month.label}: ${formatCurrency(month.profit, false, currencyCode)}`}
                      onClick={() =>
                        setActiveProfitBarKey((current) =>
                          current === (month.key ?? month.label) ? null : month.key ?? month.label,
                        )
                      }
                    />
                  </div>

                  <div className="space-y-1 text-center">
                    <p className="text-[11px] font-medium text-[var(--workspace-text)]">
                      {buildBarsLabel(month, index, barsSummary)}
                    </p>
                    <div className="h-4">
                      {isActive ? (
                        <p className={`text-[11px] ${isPositive ? "text-emerald-300" : "text-rose-200"}`}>
                          {formatCurrency(month.profit, false, currencyCode)}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })}
            </div>
          </div>
        )}
      </SectionCard>

      <div className="grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
        <SectionCard
          title="Revenue vs Expenses"
          subtitle="See how top-line inflow compares against cost load each month."
          action={
            monthlySummary.length > 12 ? (
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--workspace-muted)]">
                Last 12 months
              </div>
            ) : null
          }
        >
          {monthlySummary.length === 0 ? (
            <EmptyChartState label="No revenue or expense data for the current filters." />
          ) : (
            <div className="h-[300px] min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={revenueExpenseSummary} barGap={10}>
                  <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
                  <XAxis dataKey="label" tick={{ fill: "#93a4bf", fontSize: 12 }} tickLine={false} axisLine={false} />
                  <YAxis
                    tickFormatter={(value) => compactCurrency(value, currencyCode)}
                    tick={{ fill: "#93a4bf", fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                    width={72}
                  />
                  <Tooltip
                    formatter={(value) => formatTooltipValue(value, currencyCode)}
                    contentStyle={{
                      borderRadius: 18,
                      border: "1px solid rgba(255,255,255,0.08)",
                      background: "#101c2e",
                      color: "#e7edf5",
                    }}
                  />
                  <Bar dataKey="revenue" radius={[10, 10, 0, 0]} fill="#58c4b6" maxBarSize={18} />
                  <Bar dataKey="expenses" radius={[10, 10, 0, 0]} fill="#ec8f96" maxBarSize={18} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </SectionCard>

        <SectionCard
          title="Expenses Breakdown"
          subtitle="Understand where money is actually leaving the business."
        >
          {expensesByCategory.length === 0 ? (
            <EmptyChartState label="No expenses match the current filters." />
          ) : (
            <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
              <div className="h-[300px] min-w-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={expensesByCategory} dataKey="value" nameKey="label" innerRadius={70} outerRadius={110} paddingAngle={3}>
                      {expensesByCategory.map((entry, index) => (
                        <Cell key={entry.label} fill={categoryColors[index % categoryColors.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value) => formatTooltipValue(value, currencyCode)}
                      contentStyle={{
                        borderRadius: 18,
                        border: "1px solid rgba(255,255,255,0.08)",
                        background: "#101c2e",
                        color: "#e7edf5",
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="workspace-soft-card rounded-[22px] p-5">
                <div className="flex items-center justify-between gap-3 border-b border-white/8 pb-3">
                  <div>
                    <p className="text-sm font-semibold text-[var(--workspace-text)]">Cost Table</p>
                    <p className="mt-1 text-xs text-[var(--workspace-muted)]">Top categories by weight in the business.</p>
                  </div>
                  <span className="flex min-h-[58px] min-w-[58px] flex-col items-center justify-center rounded-full bg-white/[0.06] px-2 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--workspace-muted)]">
                    <span className="leading-none">Top</span>
                    <span className="mt-1 text-base leading-none text-[var(--workspace-text)]">5</span>
                  </span>
                </div>

                <div className="mt-3 overflow-hidden rounded-[18px] border border-white/8">
                  <div className="grid grid-cols-[minmax(0,1fr)_96px] gap-6 bg-white/[0.04] px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--workspace-muted)]">
                    <span>Category</span>
                    <span className="text-right">Share</span>
                  </div>

                  <div className="divide-y divide-white/8">
                    {costStructure.slice(0, 5).map((item, index) => (
                      <div
                        key={`cost-table-${item.label}`}
                        className="grid grid-cols-[minmax(0,1fr)_96px] gap-6 px-5 py-3 text-sm"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <span
                            className="h-3 w-3 shrink-0 rounded-full"
                            style={{ backgroundColor: categoryColors[index % categoryColors.length] }}
                          />
                          <span
                            className="truncate text-[15px] font-medium leading-5 text-[var(--workspace-text)]"
                            title={item.label}
                          >
                            {item.label}
                          </span>
                        </div>
                        <span className="text-right text-sm text-[var(--workspace-muted)]">{formatPercent(item.share)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </SectionCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <SectionCard
          title="Revenue By Channel"
          subtitle="See which channels are actually driving the business."
        >
          {revenueByChannel.length === 0 ? (
            <EmptyChartState label="No channel data for the current filters." />
          ) : (
            <div className="h-[260px] min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={revenueByChannel} layout="vertical" margin={{ left: 8 }}>
                  <CartesianGrid stroke="rgba(255,255,255,0.08)" horizontal={false} />
                  <XAxis
                    type="number"
                    tickFormatter={(value) => compactCurrency(value, currencyCode)}
                    tick={{ fill: "#93a4bf", fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="label"
                    tick={{ fill: "#93a4bf", fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                    width={90}
                  />
                  <Tooltip
                    formatter={(value) => formatTooltipValue(value, currencyCode)}
                    contentStyle={{
                      borderRadius: 18,
                      border: "1px solid rgba(255,255,255,0.08)",
                      background: "#101c2e",
                      color: "#e7edf5",
                    }}
                  />
                  <Bar dataKey="revenue" radius={[0, 12, 12, 0]} fill="#58c4b6" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </SectionCard>

        <SectionCard
          title="Monthly Performance"
          subtitle="Quick compare of the months driving the strongest results."
        >
          <div className="space-y-3">
            {monthlySummary.length === 0 ? (
              <div className="workspace-soft-card rounded-[22px] p-5 text-sm text-[var(--workspace-muted)]">
                No monthly performance data yet.
              </div>
            ) : (
              [...monthlySummary]
                .sort((left, right) => right.profit - left.profit)
                .slice(0, 5)
                .map((month) => (
                  <article key={month.label} className="workspace-soft-card rounded-[22px] p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-base font-semibold text-[var(--workspace-text)]">{month.label}</p>
                        <p className="mt-1 text-sm text-[var(--workspace-muted)]">
                          {month.bookings} bookings • {month.nights} nights
                        </p>
                      </div>
                      <span className="text-sm font-semibold text-emerald-300">
                        {formatCurrency(month.profit, false, currencyCode)}
                      </span>
                    </div>
                  </article>
                ))
            )}
          </div>
        </SectionCard>

        <SectionCard
          title="Cost Structure"
          subtitle="The categories taking the largest share of your expense base."
        >
          <div className="space-y-3">
            {costStructure.length === 0 ? (
              <div className="workspace-soft-card rounded-[22px] p-5 text-sm text-[var(--workspace-muted)]">
                No cost structure yet.
              </div>
            ) : (
              costStructure.slice(0, 5).map((item) => (
                <article key={item.label} className="workspace-soft-card rounded-[22px] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-base font-semibold text-[var(--workspace-text)]">{item.label}</p>
                      <p className="mt-1 text-sm text-[var(--workspace-muted)]">{formatPercent(item.share)} of total expenses</p>
                    </div>
                    <span className="text-sm font-semibold text-[var(--workspace-text)]">
                      {formatCurrency(item.value, false, currencyCode)}
                    </span>
                  </div>
                </article>
              ))
            )}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
