"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { ResponsiveGridLayout, useContainerWidth } from "react-grid-layout";
import {
  ArrowUpRight,
  CalendarDays,
  Eye,
  EyeOff,
  Percent,
  ReceiptText,
  RotateCcw,
  SlidersHorizontal,
  Sparkles,
  Wallet,
  WalletCards,
} from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { FilterBar } from "@/components/filter-bar";
import { Modal } from "@/components/modal";
import { WorkspaceShell } from "@/components/workspace-shell";
import {
  buildPresetWidgetLayout,
  dashboardWidgetCatalog,
  type DashboardGridLayouts,
  type DashboardWidgetId,
  type DashboardWidgetLayoutState,
  type DashboardWidgetPresetId,
  mergeUpdatedLayouts,
  normalizeWidgetLayoutState,
} from "@/lib/dashboard-widget-layout";
import { formatCurrency, formatDateLabel, formatNumber, formatPercent } from "@/lib/format";
import type { CurrencyCode, DashboardView, ImportSummary } from "@/lib/types";

const previewStorageKey = "hostlyx:widget-grid-preview-layout:v2";

function readPreviewLayoutState() {
  if (typeof window === "undefined") {
    return buildPresetWidgetLayout("executive");
  }

  const rawValue = window.localStorage.getItem(previewStorageKey);

  if (!rawValue) {
    return buildPresetWidgetLayout("executive");
  }

  try {
    return normalizeWidgetLayoutState(JSON.parse(rawValue));
  } catch {
    return buildPresetWidgetLayout("executive");
  }
}

function WidgetFrame({
  title,
  subtitle,
  action,
  children,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="workspace-card h-full select-none overflow-hidden rounded-[26px] border border-white/8 bg-[linear-gradient(180deg,rgba(16,28,46,0.95)_0%,rgba(9,18,31,0.98)_100%)] p-5 shadow-[0_18px_40px_rgba(2,6,23,0.22)]">
      <div className="widget-frame-handle -mx-1 -mt-1 mb-5 flex cursor-grab items-start justify-between gap-4 rounded-[18px] px-1 py-1 active:cursor-grabbing">
        <div>
          <p className="text-sm font-semibold tracking-tight text-[var(--workspace-text)]">{title}</p>
          {subtitle ? <p className="mt-1 text-xs leading-5 text-[var(--workspace-muted)]">{subtitle}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function SparkBars({
  values,
  positive = true,
}: {
  values: number[];
  positive?: boolean;
}) {
  const max = Math.max(...values.map((value) => Math.abs(value)), 1);

  return (
    <div className="flex h-28 items-end gap-2">
      {values.map((value, index) => (
        <div key={`spark-${index}`} className="flex-1 rounded-[18px] bg-white/[0.04] p-1.5">
          <div
            className={`w-full rounded-[14px] ${
              positive
                ? "bg-[linear-gradient(180deg,#67d4c7_0%,#2f8f84_100%)]"
                : "bg-[linear-gradient(180deg,#f2a6ae_0%,#c66474_100%)]"
            }`}
            style={{ height: `${Math.max((Math.abs(value) / max) * 100, 12)}%` }}
          />
        </div>
      ))}
    </div>
  );
}

function StackedCostBars({
  items,
}: {
  items: Array<{ label: string; share: number }>;
}) {
  const colors = ["#67d4c7", "#8ad3ca", "#90a5ef", "#f2bc74", "#ec929a"];

  return (
    <div className="space-y-4">
      <div className="flex h-3 overflow-hidden rounded-full bg-white/[0.06]">
        {items.map((item, index) => (
          <div
            key={item.label}
            style={{ width: `${Math.max(item.share * 100, 3)}%`, backgroundColor: colors[index % colors.length] }}
          />
        ))}
      </div>
      <div className="space-y-3">
        {items.map((item, index) => (
          <div key={`cost-${item.label}`} className="flex items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: colors[index % colors.length] }}
              />
              <span className="truncate text-sm text-[var(--workspace-text)]">{item.label}</span>
            </div>
            <span className="text-xs font-medium text-[var(--workspace-muted)]">{formatPercent(item.share)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function WidgetMetric({
  label,
  value,
  icon,
  accent = "default",
}: {
  label: string;
  value: string;
  icon: ReactNode;
  accent?: "default" | "positive";
}) {
  return (
    <div className="workspace-soft-card rounded-[22px] p-4">
      <div className="flex items-center gap-3">
        <div
          className={`rounded-2xl p-3 ${
            accent === "positive"
              ? "bg-emerald-400/14 text-emerald-200"
              : "workspace-icon-chip"
          }`}
        >
          {icon}
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--workspace-muted)]">{label}</p>
          <p className={`mt-1 text-xl font-semibold ${accent === "positive" ? "text-emerald-300" : "text-[var(--workspace-text)]"}`}>
            {value}
          </p>
        </div>
      </div>
    </div>
  );
}

function renderWidget(widgetId: DashboardWidgetId, view: DashboardView, currencyCode: CurrencyCode) {
  const monthlySlice = view.monthlySummary.slice(-6);
  const costSlice = view.expensesByCategory.slice(0, 5);
  const totalCost = costSlice.reduce((sum, item) => sum + item.value, 0) || 1;

  switch (widgetId) {
    case "net-profit":
      return (
        <WidgetFrame
          title="Net Profit"
          subtitle="What the business keeps after payout and expenses."
          action={<span className="rounded-full bg-emerald-400/14 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-200">Core KPI</span>}
        >
          <p className={`text-5xl font-semibold tracking-tight ${view.metrics.netProfit >= 0 ? "text-white" : "text-rose-200"}`}>
            {formatCurrency(view.metrics.netProfit, false, currencyCode)}
          </p>
          <p className="mt-4 max-w-sm text-sm leading-6 text-[var(--workspace-muted)]">
            Profit first, so the business reads like a company instead of a spreadsheet.
          </p>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <WidgetMetric label="After tax" value={formatCurrency(view.metrics.profitAfterTax, false, currencyCode)} icon={<WalletCards className="h-4 w-4" />} accent="positive" />
            <WidgetMetric label="Margin" value={formatPercent(view.metrics.profitMargin)} icon={<Percent className="h-4 w-4" />} />
          </div>
        </WidgetFrame>
      );

    case "revenue-pulse":
      return (
        <WidgetFrame title="Revenue pulse" subtitle="Last 6 months, top-line movement.">
          <SparkBars values={monthlySlice.map((month) => month.revenue)} />
          <div className="mt-3 grid grid-cols-6 gap-2 text-center text-[11px] uppercase tracking-[0.16em] text-[var(--workspace-muted)]">
            {monthlySlice.map((month) => (
              <span key={`rev-label-${month.key ?? month.label}`}>{month.label.slice(0, 3)}</span>
            ))}
          </div>
        </WidgetFrame>
      );

    case "expense-pressure":
      return (
        <WidgetFrame title="Expense pressure" subtitle="Where cost is clustering right now.">
          <StackedCostBars
            items={costSlice.map((item) => ({
              label: item.label,
              share: item.value / totalCost,
            }))}
          />
        </WidgetFrame>
      );

    case "revenue-vs-expenses":
      return (
        <WidgetFrame title="Revenue vs expenses" subtitle="Quick monthly balance read.">
          <div className="grid grid-cols-2 gap-3">
            <WidgetMetric label="Revenue" value={formatCurrency(view.metrics.totalRevenue, false, currencyCode)} icon={<Wallet className="h-4 w-4" />} />
            <WidgetMetric label="Expenses" value={formatCurrency(view.metrics.totalExpenses, false, currencyCode)} icon={<ReceiptText className="h-4 w-4" />} />
          </div>
        </WidgetFrame>
      );

    case "bookings":
      return (
        <WidgetFrame title="Bookings" subtitle="Operational throughput.">
          <div className="space-y-3">
            <WidgetMetric label="Stays" value={formatNumber(view.metrics.bookingsCount)} icon={<CalendarDays className="h-4 w-4" />} />
            <WidgetMetric label="ADR" value={formatCurrency(view.metrics.adr, false, currencyCode)} icon={<ArrowUpRight className="h-4 w-4" />} />
          </div>
        </WidgetFrame>
      );

    case "channels":
      return (
        <WidgetFrame title="Channels" subtitle="Who is driving the business.">
          <div className="space-y-3">
            {view.revenueByChannel.slice(0, 3).map((channel) => (
              <div key={channel.label} className="flex items-center justify-between gap-3 rounded-[18px] bg-white/[0.03] px-4 py-3">
                <span className="text-sm text-[var(--workspace-text)]">{channel.label}</span>
                <span className="text-sm font-semibold text-[var(--workspace-text)]">{formatCurrency(channel.revenue, false, currencyCode)}</span>
              </div>
            ))}
          </div>
        </WidgetFrame>
      );

    case "recent-bookings":
      return (
        <WidgetFrame title="Recent bookings" subtitle="Latest revenue-producing stays.">
          <div className="space-y-3">
            {view.recentBookings.slice(0, 4).map((booking) => (
              <div key={`${booking.id ?? booking.checkIn}-${booking.guestName}`} className="grid gap-3 rounded-[18px] bg-white/[0.03] px-4 py-3 lg:grid-cols-[1.25fr_0.8fr_0.7fr]">
                <div>
                  <p className="text-sm font-semibold text-[var(--workspace-text)]">{booking.guestName}</p>
                  <p className="mt-1 text-xs text-[var(--workspace-muted)]">
                    {booking.channel} • {booking.propertyName}
                  </p>
                </div>
                <p className="text-sm text-[var(--workspace-muted)]">
                  {formatDateLabel(booking.checkIn)} to {formatDateLabel(booking.checkout)}
                </p>
                <p className="text-sm font-semibold text-[var(--workspace-text)]">
                  {formatCurrency(booking.payout, false, currencyCode)}
                </p>
              </div>
            ))}
          </div>
        </WidgetFrame>
      );

    case "recent-expenses":
      return (
        <WidgetFrame title="Recent expenses" subtitle="Latest money-out activity.">
          <div className="space-y-3">
            {view.recentExpenses.slice(0, 5).map((expense) => (
              <div
                key={`${expense.id ?? expense.date}-${expense.description}`}
                className="rounded-[18px] bg-white/[0.03] px-4 py-3"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-[var(--workspace-text)]">
                      {expense.description}
                    </p>
                    <p className="mt-1 truncate text-xs text-[var(--workspace-muted)]">
                      {expense.category} • {expense.propertyName}
                    </p>
                    <p className="mt-2 text-xs text-[var(--workspace-muted)]">
                      {formatDateLabel(expense.date)}
                    </p>
                  </div>
                  <span className="shrink-0 text-sm font-semibold text-[var(--workspace-text)]">
                    {formatCurrency(expense.amount, false, currencyCode)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </WidgetFrame>
      );
  }
}

function LayoutCustomizer({
  layoutState,
  saveState,
  onToggleVisibility,
  onApplyPreset,
  onReset,
}: {
  layoutState: DashboardWidgetLayoutState;
  saveState: "idle" | "saving" | "saved" | "error";
  onToggleVisibility: (id: DashboardWidgetId) => void;
  onApplyPreset: (presetId: Exclude<DashboardWidgetPresetId, "custom">) => void;
  onReset: () => void;
}) {
  const visibleCount = dashboardWidgetCatalog.length - layoutState.hiddenIds.length;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-sm font-semibold tracking-tight text-[var(--workspace-text)]">Layout tools</p>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-[var(--workspace-muted)]">
            Show or hide widgets, switch presets, and move cards around the canvas while keeping each widget at a readable fixed size.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--workspace-muted)]">
            {saveState === "saving"
              ? "Saving"
              : saveState === "saved"
                ? "Saved"
                : saveState === "error"
                  ? "Save failed"
                  : "Ready"}
          </span>
          <button
            type="button"
            onClick={onReset}
            className="workspace-button-secondary rounded-2xl px-3 py-2 text-xs font-semibold transition"
          >
            <span className="inline-flex items-center gap-2">
              <RotateCcw className="h-3.5 w-3.5" />
              Reset
            </span>
          </button>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        {([
          "executive",
          "finance",
          "operations",
        ] as Array<Exclude<DashboardWidgetPresetId, "custom">>).map((presetId) => (
          <button
            key={presetId}
            type="button"
            onClick={() => onApplyPreset(presetId)}
            className={`rounded-2xl px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] transition ${
              layoutState.presetId === presetId
                ? "workspace-button-primary"
                : "workspace-button-secondary"
            }`}
          >
            {presetId}
          </button>
        ))}
        <span className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--workspace-muted)]">
          {layoutState.presetId === "custom" ? "Custom layout" : `${visibleCount} visible`}
        </span>
      </div>

      <div className="mt-4 grid gap-3 xl:grid-cols-2">
        {dashboardWidgetCatalog.map((widget) => {
          const visible = !layoutState.hiddenIds.includes(widget.id);

          return (
            <div key={widget.id} className="flex items-center gap-3 rounded-[22px] border border-white/8 bg-white/[0.03] px-4 py-4">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-[var(--workspace-text)]">{widget.title}</p>
                <p className="mt-1 text-xs text-[var(--workspace-muted)]">{widget.subtitle}</p>
              </div>
              <button
                type="button"
                onClick={() => onToggleVisibility(widget.id)}
                className={`inline-flex h-10 w-10 items-center justify-center rounded-2xl border transition ${
                  visible
                    ? "border-emerald-300/20 bg-emerald-400/12 text-emerald-200"
                    : "border-white/10 bg-white/[0.04] text-[var(--workspace-muted)]"
                }`}
                title={visible ? "Hide widget" : "Show widget"}
              >
                {visible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function WidgetGridContent({
  view,
  currencyCode,
  initialLayoutState,
  previewMode = false,
}: {
  view: DashboardView;
  currencyCode: CurrencyCode;
  initialLayoutState?: DashboardWidgetLayoutState;
  previewMode?: boolean;
}) {
  const [layoutState, setLayoutState] = useState<DashboardWidgetLayoutState>(() =>
    previewMode ? readPreviewLayoutState() : normalizeWidgetLayoutState(initialLayoutState),
  );
  const [isCustomizerOpen, setIsCustomizerOpen] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");

  useEffect(() => {
    if (!previewMode) {
      return;
    }

    window.localStorage.setItem(previewStorageKey, JSON.stringify(layoutState));
  }, [layoutState, previewMode]);

  useEffect(() => {
    if (previewMode) {
      return;
    }

    setSaveState("saving");

    const timeoutId = window.setTimeout(async () => {
      try {
        const response = await fetch("/api/dashboard-layout", {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ layoutState }),
        });

        if (!response.ok) {
          throw new Error("Could not save the widget layout.");
        }

        setSaveState("saved");
      } catch {
        setSaveState("error");
      }
    }, 450);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [layoutState, previewMode]);

  function applyPreset(presetId: Exclude<DashboardWidgetPresetId, "custom">) {
    setLayoutState(buildPresetWidgetLayout(presetId));
  }

  function toggleVisibility(id: DashboardWidgetId) {
    setLayoutState((current) => {
      const nextHiddenIds = current.hiddenIds.includes(id)
        ? current.hiddenIds.filter((hiddenId) => hiddenId !== id)
        : [...current.hiddenIds, id];

      return {
        ...current,
        presetId: "custom",
        hiddenIds: nextHiddenIds,
      };
    });
  }

  function resetLayout() {
    const resetState = buildPresetWidgetLayout("executive");
    setLayoutState(resetState);

    if (previewMode) {
      window.localStorage.setItem(previewStorageKey, JSON.stringify(resetState));
    }
  }

  const hiddenIdSet = useMemo(
    () => new Set(layoutState.hiddenIds),
    [layoutState.hiddenIds],
  );

  const visibleLayouts = useMemo(() => {
    const nextLayouts: DashboardGridLayouts = {};

    for (const [breakpoint, items] of Object.entries(layoutState.layouts)) {
      nextLayouts[breakpoint] = (items ?? []).filter(
        (item) => !hiddenIdSet.has(item.i as DashboardWidgetId),
      );
    }

    return nextLayouts;
  }, [layoutState.layouts, hiddenIdSet]);

  const visibleWidgetIds = dashboardWidgetCatalog
    .map((widget) => widget.id)
    .filter((widgetId) => !hiddenIdSet.has(widgetId));
  const { width, containerRef, mounted } = useContainerWidth({ initialWidth: 1280 });
  const isLayoutMode = isCustomizerOpen;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setIsCustomizerOpen(true)}
            className="workspace-button-secondary rounded-2xl px-4 py-3 text-sm font-semibold transition"
          >
            <span className="inline-flex items-center gap-2">
              <SlidersHorizontal className="h-4 w-4" />
              Layout tools
            </span>
          </button>
        </div>

        <FilterBar
          channels={view.availableChannels}
          countries={view.availableCountries}
          selectedRangePreset={view.filters.rangePreset}
          selectedStartDate={view.filters.startDate}
          selectedEndDate={view.filters.endDate}
          selectedChannel={view.filters.channel}
          selectedCountryCode={view.filters.countryCode}
        />
      </div>

      <Modal
        open={isCustomizerOpen}
        title="Layout tools"
        onClose={() => setIsCustomizerOpen(false)}
      >
        <LayoutCustomizer
          layoutState={layoutState}
          saveState={saveState}
          onToggleVisibility={toggleVisibility}
          onApplyPreset={applyPreset}
          onReset={resetLayout}
        />
      </Modal>

      {visibleWidgetIds.length === 0 ? (
        <section className="workspace-card rounded-[26px] p-8 text-center">
          <p className="text-lg font-semibold text-[var(--workspace-text)]">No widgets visible</p>
          <p className="mt-2 text-sm text-[var(--workspace-muted)]">
            Turn at least one widget back on in Customize layout.
          </p>
        </section>
      ) : (
        <div
          ref={containerRef}
          className={`widget-grid-shell rounded-[30px] border border-white/8 p-3 sm:p-4 ${
            isLayoutMode ? "select-none" : ""
          }`}
        >
          {mounted ? (
            <ResponsiveGridLayout
              width={width}
              className="widget-grid-layout"
              layouts={visibleLayouts}
              breakpoints={{ lg: 1200, md: 840, sm: 0 }}
              cols={{ lg: 12, md: 12, sm: 4 }}
              rowHeight={34}
              margin={[18, 18]}
              containerPadding={[0, 0]}
              dragConfig={{ handle: ".widget-frame-handle" }}
              resizeConfig={{ enabled: false }}
              onLayoutChange={(_, allLayouts) => {
                setLayoutState((current) => mergeUpdatedLayouts(current, allLayouts));
              }}
            >
              {visibleWidgetIds.map((widgetId) => (
                <div key={widgetId} className="widget-grid-item">
                  {renderWidget(widgetId, view, currencyCode)}
                </div>
              ))}
            </ResponsiveGridLayout>
          ) : null}
        </div>
      )}
    </div>
  );
}

function PublicPreviewShell({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <main className="min-h-screen bg-[var(--workspace-bg)] px-4 py-4 sm:px-6 xl:px-8">
      <div className="mx-auto w-full max-w-[1680px]">
        <div className="mb-4 flex flex-col gap-4 rounded-[30px] border border-white/8 bg-[rgba(10,19,33,0.72)] px-5 py-4 shadow-[0_20px_40px_rgba(2,6,23,0.18)] sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="flex items-center gap-3">
            <BrandLogo href="/showcase" compact />
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--workspace-muted)]">
              Mystodev lab
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm text-[var(--workspace-muted)]">
              Experimental grid canvas for testing widget-based dashboard layouts.
            </p>
            <Link href="/showcase" className="workspace-button-secondary rounded-2xl px-4 py-3 text-sm font-semibold transition">
              Back to showcase
            </Link>
          </div>
        </div>

        <div className="rounded-[34px] border border-[var(--workspace-border)] bg-[rgba(9,17,29,0.7)] shadow-[0_20px_40px_rgba(2,6,23,0.28)]">
          <div className="rounded-[34px] bg-[linear-gradient(180deg,rgba(11,22,38,0.92)_0%,rgba(7,17,29,0.98)_100%)] p-5 sm:p-6 xl:p-8">
            <div className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
              <div>
                <p className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--workspace-muted)]">
                  <Sparkles className="h-3.5 w-3.5 text-[var(--workspace-accent)]" />
                  Experimental layout
                </p>
                <h1 className="mt-4 text-3xl font-semibold tracking-tight text-[var(--workspace-text)] sm:text-4xl">
                  Grid-and-widgets dashboard direction
                </h1>
                <p className="mt-2 max-w-3xl text-base text-[var(--workspace-muted)]">
                  Same financial signals, reorganized into modular widgets so we can test a denser operating surface for Hostlyx.
                </p>
              </div>
              <Link href="/dashboard" className="workspace-button-secondary rounded-2xl px-4 py-3 text-sm font-semibold transition">
                Open live app
              </Link>
            </div>

            {children}
          </div>
        </div>
      </div>
    </main>
  );
}

export function DashboardWidgetLab({
  view,
  latestImport,
  userName,
  userEmail,
  businessName,
  currencyCode,
  initialLayoutState,
  previewMode = false,
}: {
  view: DashboardView;
  latestImport: ImportSummary | null;
  userName: string;
  userEmail: string;
  businessName: string;
  currencyCode: CurrencyCode;
  initialLayoutState?: DashboardWidgetLayoutState;
  previewMode?: boolean;
}) {
  if (previewMode) {
    return (
      <PublicPreviewShell>
        <WidgetGridContent
          view={view}
          currencyCode={currencyCode}
          initialLayoutState={initialLayoutState}
          previewMode
        />
      </PublicPreviewShell>
    );
  }

  return (
    <WorkspaceShell
      activePage="dashboard"
      pageTitle="Widget Grid Lab"
      pageSubtitle="Experimental modular dashboard direction for comparing a grid-and-widgets layout against the current command center."
      businessName={businessName}
      userName={userName}
      userEmail={userEmail}
      currencyCode={currencyCode}
      latestImport={latestImport}
      actions={
        <div className="flex flex-wrap items-center gap-3">
          <Link href="/dashboard" className="workspace-button-secondary rounded-2xl px-4 py-3 text-sm font-semibold transition">
            Back to standard view
          </Link>
        </div>
      }
    >
      <WidgetGridContent
        view={view}
        currencyCode={currencyCode}
        initialLayoutState={initialLayoutState}
      />
    </WorkspaceShell>
  );
}
