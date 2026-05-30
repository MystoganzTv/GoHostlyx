import type { ImportCellValue } from "./types";

export function parseMoney(value: ImportCellValue) {
  if (typeof value === "number") {
    return {
      value,
      malformed: false,
      currency: "",
    };
  }

  const raw = String(value ?? "").trim();

  if (!raw) {
    return {
      value: 0,
      malformed: false,
      currency: "",
    };
  }

  let currency = "";

  if (raw.includes("€")) {
    currency = "EUR";
  } else if (raw.includes("$")) {
    currency = "USD";
  } else if (raw.includes("£")) {
    currency = "GBP";
  }

  const negative = raw.startsWith("(") && raw.endsWith(")");
  let cleaned = raw.replace(/[^\d,.-]/g, "");

  if (!cleaned) {
    return {
      value: 0,
      malformed: true,
      currency,
    };
  }

  if (cleaned.includes(",") && cleaned.includes(".")) {
    cleaned =
      cleaned.lastIndexOf(",") > cleaned.lastIndexOf(".")
        ? cleaned.replace(/\./g, "").replace(",", ".")
        : cleaned.replace(/,/g, "");
  } else if (cleaned.includes(",")) {
    cleaned =
      cleaned.split(",").length - 1 === 1
        ? cleaned.replace(",", ".")
        : cleaned.replace(/,/g, "");
  }

  const amount = Number(cleaned);

  return {
    value: Number.isFinite(amount) ? (negative ? -amount : amount) : 0,
    malformed: !Number.isFinite(amount),
    currency,
  };
}

export function inferCurrency(...values: string[]) {
  return values.find((value) => value)?.trim() ?? "";
}
