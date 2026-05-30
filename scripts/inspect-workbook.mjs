import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const XLSX = require("xlsx");

const file = process.argv[2];

if (!file) {
  throw new Error("Provide a workbook path.");
}

const bookingMap = {
  checkIn: ["checkin"],
  checkout: ["checkout"],
  guestName: ["guestname"],
  guestCount: ["ofguests", "guests", "guestcount"],
  channel: ["channel"],
  rentalPeriod: ["rentalperiod"],
  pricePerNight: ["pricepernight"],
  extraFee: ["extrafee"],
  discount: ["discount"],
  rentalRevenue: ["rentalrevenue"],
  cleaningFee: ["cleaningfee"],
  totalRevenue: ["totalrevenue"],
  hostFee: ["hostfee"],
  payout: ["payout"],
};

const expenseMap = {
  date: ["date"],
  category: ["category"],
  amount: ["amount"],
  description: ["description"],
  note: ["note"],
};

function normalize(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function getRows(sheet) {
  return XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    raw: false,
    defval: "",
    blankrows: false,
  });
}

function mapHeaderIndexes(headers, columns) {
  const normalizedHeaders = headers.map((header) => normalize(header));

  return Object.fromEntries(
    Object.entries(columns).map(([key, aliases]) => {
      const index = normalizedHeaders.findIndex((header) =>
        aliases.includes(header),
      );

      if (index === -1) {
        throw new Error(`Missing required column: ${key}`);
      }

      return [key, index];
    }),
  );
}

function findHeaderRowIndex(rows, columns) {
  for (let index = 0; index < Math.min(rows.length, 12); index += 1) {
    try {
      mapHeaderIndexes(rows[index], columns);
      return index;
    } catch {
      continue;
    }
  }

  throw new Error("Could not find the expected header row.");
}

function parseCurrency(value) {
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
  return Number.isFinite(amount) ? (negative ? -amount : amount) : 0;
}

function parseDate(value) {
  if (!value && value !== 0) {
    return "";
  }

  const parsed = new Date(String(value).trim());
  return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString().slice(0, 10);
}

const workbook = XLSX.readFile(file, { cellDates: true });
const bookingRows = getRows(workbook.Sheets.Bookings);
const expenseRows = getRows(workbook.Sheets.Expenses);
const bookingHeaderRow = findHeaderRowIndex(bookingRows, bookingMap);
const expenseHeaderRow = findHeaderRowIndex(expenseRows, expenseMap);
const bookingIndexes = mapHeaderIndexes(bookingRows[bookingHeaderRow], bookingMap);
const expenseIndexes = mapHeaderIndexes(expenseRows[expenseHeaderRow], expenseMap);

const bookings = bookingRows
  .slice(bookingHeaderRow + 1)
  .filter((row) => row.some((cell) => String(cell ?? "").trim() !== ""))
  .map((row) => ({
    checkIn: parseDate(row[bookingIndexes.checkIn]),
    checkout: parseDate(row[bookingIndexes.checkout]),
    guestName: String(row[bookingIndexes.guestName] ?? "").trim() || "Guest",
    channel: String(row[bookingIndexes.channel] ?? "").trim() || "Unassigned",
    totalRevenue: parseCurrency(row[bookingIndexes.totalRevenue]),
    payout: parseCurrency(row[bookingIndexes.payout]),
  }))
  .filter((row) => row.checkIn && row.checkout);

const expenses = expenseRows
  .slice(expenseHeaderRow + 1)
  .filter((row) => row.some((cell) => String(cell ?? "").trim() !== ""))
  .map((row) => ({
    date: parseDate(row[expenseIndexes.date]),
    category: String(row[expenseIndexes.category] ?? "").trim() || "Other",
    amount: parseCurrency(row[expenseIndexes.amount]),
    description:
      String(row[expenseIndexes.description] ?? "").trim() ||
      "Expense import entry",
  }))
  .filter((row) => row.date);

console.log(
  JSON.stringify(
    {
      bookingHeaderRow,
      expenseHeaderRow,
      bookingCount: bookings.length,
      expenseCount: expenses.length,
      firstBooking: bookings[0],
      firstExpense: expenses[0],
      lastExpense: expenses.at(-1),
    },
    null,
    2,
  ),
);
