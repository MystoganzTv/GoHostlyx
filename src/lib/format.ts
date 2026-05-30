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
  return new Intl.NumberFormat(getIntlLocale(locale));
}

function getCurrencyFormatter(
  currencyCode: CurrencyCode,
  precise: boolean,
  locale: AppLocale,
) {
  return new Intl.NumberFormat(getIntlLocale(locale), {
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
