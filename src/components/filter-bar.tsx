"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { startTransition, useEffect, useState } from "react";
import { Funnel } from "lucide-react";
import { useLocale } from "@/components/locale-provider";
import { WorkspaceDateField } from "@/components/workspace-date-field";
import { WorkspaceSelect } from "@/components/workspace-select";
import { getMarketDefinition } from "@/lib/markets";
import type { CountryCode, DashboardDateRangePreset } from "@/lib/types";

const rangeFilterStorageKey = "hostlyx:filters:range";
const calendarFilterStorageKey = "hostlyx:filters:calendar";

function buildFilterHref(pathname: string, params: URLSearchParams) {
  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}

type FilterBarProps = {
  countries: CountryCode[];
  channels: string[];
  selectedChannel: string | "all";
  selectedCountryCode: CountryCode | "all";
  showChannelSelect?: boolean;
  embedded?: boolean;
  rangeShortcutYears?: number[];
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
  const { locale } = useLocale();
  const isSpanish = locale === "es";
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const mode = props.mode ?? "range";
  const rangeProps = mode === "range" ? (props as Extract<FilterBarProps, { mode?: "range" }>) : null;
  const calendarProps =
    mode === "calendar" ? (props as Extract<FilterBarProps, { mode: "calendar" }>) : null;
  const embedded = props.embedded ?? false;
  const [draftStartDate, setDraftStartDate] = useState(rangeProps?.selectedStartDate ?? "");
  const [draftEndDate, setDraftEndDate] = useState(rangeProps?.selectedEndDate ?? "");
  const monthOptions = [
    { value: "all", label: isSpanish ? "Todos los meses" : "All months" },
    { value: "1", label: isSpanish ? "Enero" : "January" },
    { value: "2", label: isSpanish ? "Febrero" : "February" },
    { value: "3", label: isSpanish ? "Marzo" : "March" },
    { value: "4", label: isSpanish ? "Abril" : "April" },
    { value: "5", label: isSpanish ? "Mayo" : "May" },
    { value: "6", label: isSpanish ? "Junio" : "June" },
    { value: "7", label: isSpanish ? "Julio" : "July" },
    { value: "8", label: isSpanish ? "Agosto" : "August" },
    { value: "9", label: isSpanish ? "Septiembre" : "September" },
    { value: "10", label: isSpanish ? "Octubre" : "October" },
    { value: "11", label: isSpanish ? "Noviembre" : "November" },
    { value: "12", label: isSpanish ? "Diciembre" : "December" },
  ];
  const rangeOptions: Array<{ value: DashboardDateRangePreset; label: string }> = [
    { value: "all-time", label: isSpanish ? "Todo el tiempo" : "All time" },
    { value: "this-year", label: isSpanish ? "Este año" : "This year" },
    { value: "last-year", label: isSpanish ? "Año pasado" : "Last year" },
    { value: "this-month", label: isSpanish ? "Este mes" : "This month" },
    { value: "last-90-days", label: isSpanish ? "Últimos 90 días" : "Last 90 days" },
    { value: "custom", label: isSpanish ? "Personalizado" : "Custom" },
  ];

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      if (!rangeProps || rangeProps.selectedRangePreset !== "custom") {
        setDraftStartDate("");
        setDraftEndDate("");
        return;
      }

      setDraftStartDate(rangeProps.selectedStartDate);
      setDraftEndDate(rangeProps.selectedEndDate);
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [rangeProps]);

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
      const shouldRestoreCalendarFilters =
        mode === "range"
          ? true
          : (parsed.year && parsed.year !== "all") ||
            (parsed.month && parsed.month !== "all") ||
            (parsed.channel && parsed.channel !== "all") ||
            (parsed.country && parsed.country !== "all");

      if (!shouldRestoreCalendarFilters) {
        return;
      }

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
        router.replace(buildFilterHref(pathname, params), { scroll: false });
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
      router.replace(buildFilterHref(pathname, params), { scroll: mode === "calendar" });
    });
  }

  const channelOptions = [
    { value: "all", label: isSpanish ? "Todos los canales" : "All channels" },
    ...props.channels.map((channel) => ({
      value: channel,
      label: channel,
    })),
  ];

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

  function applyFullYearShortcut(year: number) {
    const start = `${year}-01-01`;
    const end = `${year}-12-31`;
    const params = new URLSearchParams(searchParams.toString());
    params.delete("year");
    params.delete("month");
    params.set("range", "custom");
    params.set("start", start);
    params.set("end", end);
    setDraftStartDate(start);
    setDraftEndDate(end);
    persistRangeFilters(params);
    replaceParams(params);
  }

  function updateCustomRange(startValue: string, endValue: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("year");
    params.delete("month");
    params.set("range", "custom");

    if (startValue) {
      params.set("start", startValue);
    } else {
      params.delete("start");
    }

    if (endValue) {
      params.set("end", endValue);
    } else {
      params.delete("end");
    }

    persistRangeFilters(params);
    replaceParams(params);
  }

  function updateCustomDateField(key: "start" | "end", value: string) {
    if (key === "start") {
      setDraftStartDate(value);

      if (value && draftEndDate) {
        updateCustomRange(value, draftEndDate);
      }

      return;
    }

    setDraftEndDate(value);

    if (draftStartDate && value) {
      updateCustomRange(draftStartDate, value);
    }
  }

  function updateCalendarFilter(key: "year" | "month" | "channel" | "country", value: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("range");
    params.delete("start");
    params.delete("end");
    params.set(key, value);

    if (key === "year") {
      params.set("month", "all");
    }

    persistCalendarFilters(params);
    replaceParams(params);
  }

  return (
    <div
      className={`flex flex-wrap items-center gap-3 ${
        embedded
          ? ""
          : "rounded-[24px] border border-[var(--workspace-border)] bg-[var(--workspace-panel)] p-3 shadow-[0_12px_28px_rgba(15,23,42,0.04)]"
      }`}
    >
      <div className="flex items-center gap-2 px-2 text-sm font-semibold text-[var(--workspace-muted)]">
        <Funnel className="h-4 w-4 text-[var(--workspace-accent)]" />
        {isSpanish ? "Filtros" : "Filters"}
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
          {isSpanish ? "Todos los mercados" : "All markets"}
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
          {props.rangeShortcutYears && props.rangeShortcutYears.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2">
              {props.rangeShortcutYears.map((year) => {
                const isActiveFullYear =
                  rangeProps.selectedRangePreset === "custom" &&
                  rangeProps.selectedStartDate === `${year}-01-01` &&
                  rangeProps.selectedEndDate === `${year}-12-31`;

                return (
                  <button
                    key={year}
                    type="button"
                    onClick={() => applyFullYearShortcut(year)}
                    className={`rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                      isActiveFullYear ? "workspace-button-primary" : "workspace-button-secondary"
                    }`}
                  >
                    {year}
                  </button>
                );
              })}
            </div>
          ) : null}
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
                label={isSpanish ? "Fecha inicial" : "Start date"}
                value={draftStartDate}
                onChange={(value) => updateCustomDateField("start", value)}
                placeholder={isSpanish ? "Fecha inicial" : "Start date"}
                compact
                hideLabel
                className="min-w-[170px]"
              />
              <WorkspaceDateField
                name="end"
                label={isSpanish ? "Fecha final" : "End date"}
                value={draftEndDate}
                onChange={(value) => updateCustomDateField("end", value)}
                placeholder={isSpanish ? "Fecha final" : "End date"}
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
              { value: "all", label: isSpanish ? "Todos los años" : "All years" },
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
          options={channelOptions}
        />
      ) : null}
    </div>
  );
}
