import type { CountryCode, CurrencyCode } from "./types";

type MarketDefinition = {
  countryCode: CountryCode;
  countryName: string;
  shortLabel: string;
  regionLabel: string;
  currencyCode: CurrencyCode;
  currencyLabel: string;
  locale: string;
};

export const marketDefinitions: MarketDefinition[] = [
  {
    countryCode: "US",
    countryName: "United States",
    shortLabel: "USA",
    regionLabel: "North America",
    currencyCode: "USD",
    currencyLabel: "US Dollar",
    locale: "en-US",
  },
  {
    countryCode: "ES",
    countryName: "Spain",
    shortLabel: "Spain",
    regionLabel: "Europe",
    currencyCode: "EUR",
    currencyLabel: "Euro",
    locale: "es-ES",
  },
  {
    countryCode: "GB",
    countryName: "United Kingdom",
    shortLabel: "United Kingdom",
    regionLabel: "Europe",
    currencyCode: "GBP",
    currencyLabel: "British Pound",
    locale: "en-GB",
  },
];

export function normalizeCountryCode(value: string | undefined): CountryCode {
  return marketDefinitions.find((market) => market.countryCode === value)?.countryCode ?? "US";
}

export function normalizeCurrencyCode(value: string | undefined): CurrencyCode {
  return marketDefinitions.find((market) => market.currencyCode === value)?.currencyCode ?? "USD";
}

export function getMarketDefinition(countryCode: CountryCode) {
  return marketDefinitions.find((market) => market.countryCode === countryCode) ?? marketDefinitions[0];
}

export function getCurrencyForCountry(countryCode: CountryCode): CurrencyCode {
  return getMarketDefinition(countryCode).currencyCode;
}

export function getCountryForCurrency(currencyCode: string | undefined): CountryCode {
  const normalizedCurrencyCode = normalizeCurrencyCode(currencyCode);
  return marketDefinitions.find((market) => market.currencyCode === normalizedCurrencyCode)?.countryCode ?? "US";
}

export function getLocaleForCurrency(currencyCode: CurrencyCode) {
  return marketDefinitions.find((market) => market.currencyCode === currencyCode)?.locale ?? "en-US";
}
