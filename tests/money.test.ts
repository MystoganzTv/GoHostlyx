import { describe, expect, it } from "vitest";
import { parseMoney } from "@/lib/import/money";

describe("parseMoney", () => {
  it.each([
    ["$1,234", 1234],
    ["$1,234.56", 1234.56],
    ["1.234,56 €", 1234.56],
    ["1234,50", 1234.5],
    ["€1.234", 1234],
    ["1.234.567,89", 1234567.89],
    ["12.5", 12.5],
    ["(45.00)", -45],
    ["-80", -80],
    ["£99", 99],
  ])("parses %s as %d", (input, expected) => {
    expect(parseMoney(input).value).toBeCloseTo(expected, 2);
  });

  it("detects the currency symbol", () => {
    expect(parseMoney("€10").currency).toBe("EUR");
    expect(parseMoney("$10").currency).toBe("USD");
    expect(parseMoney("£10").currency).toBe("GBP");
  });

  it("treats empty cells as zero and garbage as malformed", () => {
    expect(parseMoney("")).toMatchObject({ value: 0, malformed: false });
    expect(parseMoney("n/a")).toMatchObject({ value: 0, malformed: true });
  });

  it("passes numbers through", () => {
    expect(parseMoney(1500).value).toBe(1500);
  });
});
