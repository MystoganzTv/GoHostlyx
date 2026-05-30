import { enUS, es } from "date-fns/locale";

export type AppLocale = "en" | "es";

export const localeCookieName = "hostlyx-locale";
export const localeStorageKey = "hostlyx-locale";

export function normalizeLocale(value: string | null | undefined): AppLocale {
  return value === "es" ? "es" : "en";
}

export function isSpanishLocale(locale: AppLocale) {
  return locale === "es";
}

export function getIntlLocale(locale: AppLocale) {
  return locale === "es" ? "es-ES" : "en-US";
}

export function getDateFnsLocale(locale: AppLocale) {
  return locale === "es" ? es : enUS;
}

export function pickLocale<T>(locale: AppLocale, values: { en: T; es: T }) {
  return locale === "es" ? values.es : values.en;
}

