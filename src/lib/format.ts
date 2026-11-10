import { format, parseISO } from "date-fns";
import { getDateFnsLocale, getIntlLocale, type AppLocale } from "./i18n";
import type { CurrencyCode } from "./types";

function getPercentFormatter(locale: AppLocale) {
  return new Intl.NumberFormat(getIntlLocale(locale), {
    style: "percent",
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
}

function getNumberFormatter(locale: AppLocale) {
  return new Intl.NumberFormat(getIntlLocale(locale), { useGrouping: "always" });
}

function getCurrencyFormatter(
  currencyCode: CurrencyCode,
  precise: boolean,
  locale: AppLocale,
) {
  return new Intl.NumberFormat(getIntlLocale(locale), {
    // Spanish leaves 4-digit amounts ungrouped by default (5135 next to 19.234);
    // money reads better grouped the same way everywhere.
    useGrouping: "always",
    style: "currency",
    currency: currencyCode,
    minimumFractionDigits: precise ? 0 : 0,
    maximumFractionDigits: precise ? 2 : 0,
  });
}

export function formatCurrency(
  value: number,
  precise = false,
  currencyCode: CurrencyCode = "USD",
  locale: AppLocale = "en",
) {
  return getCurrencyFormatter(currencyCode, precise, locale).format(
    Number.isFinite(value) ? value : 0,
  );
}

export function formatPercent(value: number, locale: AppLocale = "en") {
  return getPercentFormatter(locale).format(Number.isFinite(value) ? value : 0);
}

export function formatNumber(value: number, locale: AppLocale = "en") {
  return getNumberFormatter(locale).format(Number.isFinite(value) ? value : 0);
}

export function formatMetricValue(
  value: number,
  type: "currency" | "percent" | "number",
  currencyCode: CurrencyCode = "USD",
  locale: AppLocale = "en",
) {
  if (type === "percent") {
    return formatPercent(value, locale);
  }

  if (type === "number") {
    return formatNumber(value, locale);
  }

  return formatCurrency(value, false, currencyCode, locale);
}

export function formatDateLabel(value: string, locale: AppLocale = "en") {
  return format(parseISO(value), locale === "es" ? "d MMM yyyy" : "MMM d, yyyy", {
    locale: getDateFnsLocale(locale),
  });
}

/** Month labels are built in English ("Jan", "Jan 2026"); this renders them in the user's language. */
export function formatMonthLabel(point: { key?: string; label: string }, locale: AppLocale) {
  if (locale === "en" || !point.key || !/^\d{4}-\d{2}$/.test(point.key)) {
    return point.label;
  }

  const date = parseISO(`${point.key}-01`);
  const withYear = /\d{4}/.test(point.label);
  const label = format(date, withYear ? "MMM yyyy" : "MMM", { locale: getDateFnsLocale(locale) }).replace(".", "");
  return label.charAt(0).toUpperCase() + label.slice(1);
}
