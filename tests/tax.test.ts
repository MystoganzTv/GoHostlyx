import { describe, expect, it } from "vitest";
import {
  calculateEstimatedTaxes,
  calculateProfitAfterTax,
  getAppliedTaxSettings,
  normalizeTaxRate,
} from "@/lib/tax";

describe("tax estimates", () => {
  it("never taxes a loss", () => {
    expect(calculateEstimatedTaxes(-500, 25)).toBe(0);
    expect(calculateProfitAfterTax(-500, 25)).toBe(-500);
  });

  it("applies the rate to positive profit", () => {
    expect(calculateEstimatedTaxes(1000, 25)).toBe(250);
    expect(calculateProfitAfterTax(1000, 25)).toBe(750);
  });

  it("clamps rates to 0-100", () => {
    expect(normalizeTaxRate(140)).toBe(100);
    expect(normalizeTaxRate(-3)).toBe(0);
    expect(normalizeTaxRate("abc")).toBe(0);
  });

  it("uses the saved custom rate only for the saved market", () => {
    const saved = { savedCountryCode: "US" as const, savedTaxRate: 30 };
    expect(getAppliedTaxSettings({ selectedCountryCode: "US", ...saved }).taxRate).toBe(30);
    expect(getAppliedTaxSettings({ selectedCountryCode: "ES", ...saved }).taxRate).toBe(24);
  });
});
