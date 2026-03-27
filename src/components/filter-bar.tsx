"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { startTransition, useEffect } from "react";
import { Funnel } from "lucide-react";
import { useLocale } from "@/components/locale-provider";
import { WorkspaceDateField } from "@/components/workspace-date-field";
import { WorkspaceSelect } from "@/components/workspace-select";
import { getMarketDefinition } from "@/lib/markets";
import type { CountryCode, DashboardDateRangePreset } from "@/lib/types";

const rangeFilterStorageKey = "hostlyx:filters:range";
const calendarFilterStorageKey = "hostlyx:filters:calendar";

type FilterBarProps = {
  countries: CountryCode[];
  channels: string[];
  selectedChannel: string | "all";
  selectedCountryCode: CountryCode | "all";
  showChannelSelect?: boolean;
} & (
  | {
      mode?: "range";
      selectedRangePreset: DashboardDateRangePreset;
      selectedStartDate: string;
      selectedEndDate: string;
      years?: never;
      selectedYear?: never;
      selectedMonth?: never;
      showMonthSelect?: never;
    }
  | {
      mode: "calendar";
      years: number[];
      selectedYear: number | "all";
      selectedMonth: number | "all";
      selectedRangePreset?: never;
      selectedStartDate?: never;
      selectedEndDate?: never;
      showMonthSelect?: boolean;
    }
);

export function FilterBar(props: FilterBarProps) {
  const { t } = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const mode = props.mode ?? "range";
  const rangeProps = mode === "range" ? (props as Extract<FilterBarProps, { mode?: "range" }>) : null;
  const calendarProps =
    mode === "calendar" ? (props as Extract<FilterBarProps, { mode: "calendar" }>) : null;
  const monthOptions = [
    { value: "all", label: t("filter.allMonths") },
    { value: "1", label: t("filter.january") },
    { value: "2", label: t("filter.february") },
    { value: "3", label: t("filter.march") },
    { value: "4", label: t("filter.april") },
    { value: "5", label: t("filter.may") },
    { value: "6", label: t("filter.june") },
    { value: "7", label: t("filter.july") },
    { value: "8", label: t("filter.august") },
    { value: "9", label: t("filter.september") },
    { value: "10", label: t("filter.october") },
    { value: "11", label: t("filter.november") },
    { value: "12", label: t("filter.december") },
  ];
  const rangeOptions: Array<{ value: DashboardDateRangePreset; label: string }> = [
    { value: "all-time", label: t("filter.allTime") },
    { value: "this-year", label: t("filter.thisYear") },
    { value: "this-month", label: t("filter.thisMonth") },
    { value: "last-90-days", label: t("filter.last90Days") },
    { value: "custom", label: t("filter.custom") },
  ];

  useEffect(() => {
    const hasExplicitFilters =
      mode === "range"
        ? searchParams.has("range") ||
          searchParams.has("start") ||
          searchParams.has("end") ||
          searchParams.has("channel") ||
          searchParams.has("country")
        : searchParams.has("year") ||
          searchParams.has("month") ||
          searchParams.has("channel") ||
          searchParams.has("country");

    if (hasExplicitFilters) {
      return;
    }

    const savedFilters = window.localStorage.getItem(
      mode === "range" ? rangeFilterStorageKey : calendarFilterStorageKey,
    );

    if (!savedFilters) {
      return;
    }

    try {
      const parsed = JSON.parse(savedFilters) as Record<string, string | undefined>;
      const params = new URLSearchParams(searchParams.toString());

      if (mode === "range") {
        if (parsed.range) {
          params.set("range", parsed.range);
        }
        if (parsed.start) {
          params.set("start", parsed.start);
        }
        if (parsed.end) {
          params.set("end", parsed.end);
        }
      } else {
        if (parsed.year) {
          params.set("year", parsed.year);
        }
        if (parsed.month) {
          params.set("month", parsed.month);
        }
      }

      if (parsed.channel) {
        params.set("channel", parsed.channel);
      }

      if (parsed.country) {
        params.set("country", parsed.country);
      }

      if (params.toString()) {
        router.replace(`${pathname}?${params.toString()}`, { scroll: false });
      }
    } catch {
      window.localStorage.removeItem(
        mode === "range" ? rangeFilterStorageKey : calendarFilterStorageKey,
      );
    }
  }, [mode, pathname, router, searchParams]);

  function persistRangeFilters(params: URLSearchParams) {
    window.localStorage.setItem(
      rangeFilterStorageKey,
      JSON.stringify({
        range: params.get("range") ?? "all-time",
        start: params.get("start") ?? "",
        end: params.get("end") ?? "",
        channel: params.get("channel") ?? "all",
        country: params.get("country") ?? "all",
      }),
    );
  }

  function persistCalendarFilters(params: URLSearchParams) {
    window.localStorage.setItem(
      calendarFilterStorageKey,
      JSON.stringify({
        year: params.get("year") ?? "all",
        month: params.get("month") ?? "all",
        channel: params.get("channel") ?? "all",
        country: params.get("country") ?? "all",
      }),
    );
  }

  function replaceParams(params: URLSearchParams) {
    startTransition(() => {
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    });
  }

  function updateRangeFilter(key: "range" | "start" | "end" | "channel" | "country", value: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("year");
    params.delete("month");
    params.set(key, value);

    if (key === "range" && value !== "custom") {
      params.delete("start");
      params.delete("end");
    }

    persistRangeFilters(params);
    replaceParams(params);
  }

  function updateCalendarFilter(key: "year" | "month" | "channel" | "country", value: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("range");
    params.delete("start");
    params.delete("end");
    params.set(key, value);

    if (key === "year" && value === "all") {
      params.set("month", "all");
    }

    persistCalendarFilters(params);
    replaceParams(params);
  }

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-[24px] border border-[var(--workspace-border)] bg-[var(--workspace-panel)] p-3 shadow-[0_12px_28px_rgba(15,23,42,0.04)]">
      <div className="flex items-center gap-2 px-2 text-sm font-semibold text-[var(--workspace-muted)]">
        <Funnel className="h-4 w-4 text-[var(--workspace-accent)]" />
        {t("filter.filters")}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() =>
            mode === "range"
              ? updateRangeFilter("country", "all")
              : updateCalendarFilter("country", "all")
          }
          className={`rounded-2xl px-4 py-3 text-sm font-semibold transition ${
            props.selectedCountryCode === "all"
              ? "workspace-button-primary"
              : "workspace-button-secondary"
          }`}
        >
          {t("filter.allMarkets")}
        </button>
        {props.countries.map((countryCode) => {
          const market = getMarketDefinition(countryCode);

          return (
            <button
              key={countryCode}
              type="button"
              onClick={() =>
                mode === "range"
                  ? updateRangeFilter("country", countryCode)
                  : updateCalendarFilter("country", countryCode)
              }
              className={`rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                props.selectedCountryCode === countryCode
                  ? "workspace-button-primary"
                  : "workspace-button-secondary"
              }`}
            >
              {market.shortLabel}
            </button>
          );
        })}
      </div>

      {rangeProps ? (
        <>
          <WorkspaceSelect
            compact
            className="min-w-[170px]"
            value={rangeProps.selectedRangePreset}
            onChange={(value) => updateRangeFilter("range", value)}
            options={rangeOptions}
          />
          {rangeProps.selectedRangePreset === "custom" ? (
            <>
              <WorkspaceDateField
                name="start"
                label="Start date"
                value={rangeProps.selectedStartDate}
                onChange={(value) => updateRangeFilter("start", value)}
                placeholder="Start date"
                compact
                hideLabel
                className="min-w-[170px]"
              />
              <WorkspaceDateField
                name="end"
                label="End date"
                value={rangeProps.selectedEndDate}
                onChange={(value) => updateRangeFilter("end", value)}
                placeholder="End date"
                compact
                hideLabel
                className="min-w-[170px]"
              />
            </>
          ) : null}
        </>
      ) : (
        <>
          <WorkspaceSelect
            compact
            className="min-w-[150px]"
            value={String(calendarProps?.selectedYear ?? "all")}
            onChange={(value) => updateCalendarFilter("year", value)}
            options={[
              { value: "all", label: "All years" },
              ...(calendarProps?.years ?? []).map((year) => ({ value: String(year), label: String(year) })),
            ]}
          />
          {(calendarProps?.showMonthSelect ?? true) ? (
            <WorkspaceSelect
              compact
              className="min-w-[170px]"
              value={String(calendarProps?.selectedMonth ?? "all")}
              onChange={(value) => updateCalendarFilter("month", value)}
              options={monthOptions}
            />
          ) : null}
        </>
      )}

      {props.showChannelSelect ?? true ? (
        <WorkspaceSelect
          compact
          className="min-w-[170px]"
          value={props.selectedChannel}
          onChange={(value) =>
            mode === "range"
              ? updateRangeFilter("channel", value)
              : updateCalendarFilter("channel", value)
          }
          options={[
            { value: "all", label: "All Channels" },
            ...props.channels.map((channel) => ({ value: channel, label: channel })),
          ]}
        />
      ) : null}
    </div>
  );
}
