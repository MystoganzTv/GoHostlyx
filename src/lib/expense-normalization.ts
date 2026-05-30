type CellValue = unknown;

function parseCurrencyLike(value: CellValue) {
  if (typeof value === "number") {
    return value;
  }

  const raw = String(value ?? "").trim();

  if (!raw) {
    return 0;
  }

  const negative = raw.startsWith("(") && raw.endsWith(")");
  let cleaned = raw.replace(/[^\d,.-]/g, "");

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

  if (!Number.isFinite(amount)) {
    return 0;
  }

  return negative ? -amount : amount;
}

function looksLikeCurrencyText(value: string) {
  const raw = value.trim();

  if (!raw) {
    return false;
  }

  return /^[(\-]?\s*[€$£]?\s*\d[\d.,]*\s*\)?$/.test(raw);
}

export function normalizeExpenseFields({
  amountValue,
  descriptionValue,
  noteValue,
}: {
  amountValue: CellValue;
  descriptionValue: CellValue;
  noteValue: CellValue;
}) {
  const parsedAmount = parseCurrencyLike(amountValue);
  const rawDescription = String(descriptionValue ?? "").trim();
  const rawNote = String(noteValue ?? "").trim();

  if ((parsedAmount === 0 || !Number.isFinite(parsedAmount)) && looksLikeCurrencyText(rawDescription)) {
    return {
      amount: parseCurrencyLike(rawDescription),
      description: rawNote || "Expense import entry",
      note: "",
    };
  }

  return {
    amount: parsedAmount,
    description: rawDescription || "Expense import entry",
    note: rawNote,
  };
}
