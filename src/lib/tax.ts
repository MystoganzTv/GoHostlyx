import type { CountryCode } from "./types";

const defaultTaxRates: Record<CountryCode, number> = {
  US: 25,
  ES: 24,
  GB: 22,
};

export function getDefaultTaxRateByCountry(countryCode: CountryCode) {
  return defaultTaxRates[countryCode] ?? 25;
}

export function normalizeTaxRate(value: number | string | null | undefined) {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number.parseFloat(value)
        : Number.NaN;

  if (!Number.isFinite(parsed)) {
    return 0;
  }

  return Math.min(100, Math.max(0, parsed));
}

export function calculateEstimatedTaxes(netProfit: number, taxRate: number) {
  if (!Number.isFinite(netProfit) || netProfit <= 0) {
    return 0;
  }

  const normalizedTaxRate = normalizeTaxRate(taxRate) / 100;

  return netProfit * normalizedTaxRate;
}

export function calculateProfitAfterTax(netProfit: number, taxRate: number) {
  if (!Number.isFinite(netProfit)) {
    return 0;
  }

  return netProfit - calculateEstimatedTaxes(netProfit, taxRate);
}

export function getAppliedTaxSettings({
  selectedCountryCode,
  savedCountryCode,
  savedTaxRate,
}: {
  selectedCountryCode: CountryCode | "all";
  savedCountryCode: CountryCode;
  savedTaxRate: number;
}) {
  const normalizedSavedCountryCode = savedCountryCode;
  const normalizedSavedTaxRate = normalizeTaxRate(savedTaxRate);
  const savedDefaultTaxRate = getDefaultTaxRateByCountry(normalizedSavedCountryCode);
  const usesCustomSavedRate = normalizedSavedTaxRate !== savedDefaultTaxRate;
  const effectiveCountryCode =
    selectedCountryCode === "all" ? normalizedSavedCountryCode : selectedCountryCode;
  const suggestedTaxRate = getDefaultTaxRateByCountry(effectiveCountryCode);
  const usesSavedSettings =
    selectedCountryCode === "all" ||
    (effectiveCountryCode === normalizedSavedCountryCode && usesCustomSavedRate);
  const effectiveTaxRate = usesSavedSettings ? normalizedSavedTaxRate : suggestedTaxRate;

  return {
    countryCode: effectiveCountryCode,
    savedCountryCode: normalizedSavedCountryCode,
    taxRate: effectiveTaxRate,
    suggestedTaxRate,
    usesSavedSettings,
    usesCustomRate: usesSavedSettings && effectiveTaxRate !== suggestedTaxRate,
  };
}
