// Nightly prices: what a listing asked per night on a channel's calendar,
// booked or not. Hosts upload them as a spreadsheet (one row per date) and the
// calendar shows each night's price next to last year's.

import { normalizeHeader } from "@/lib/import/columnMatchers";
import { parseImportDate } from "@/lib/import/dates";
import { parseMoney } from "@/lib/import/money";
import { parseWorkbook } from "@/lib/import/parseWorkbook";
import type { ImportCellValue, ImportSheetRow } from "@/lib/import/types";
import { shiftDateKey } from "@/lib/nightly-price-compare";

export type NightlyPriceInput = { date: string; price: number };

export type NightlyPriceRecord = NightlyPriceInput & {
  propertyName: string;
  channel: string;
};

const dateHeaders = new Set(["date", "fecha", "night", "noche", "dia", "nightof"]);

// Columns holding the price for the row's own date.
const priceHeaders = new Set([
  "price",
  "prices",
  "pricenow",
  "airbnbprice",
  "bookingprice",
  "nightlyprice",
  "pricepernight",
  "nightlyrate",
  "rate",
  "precio",
  "precioactual",
  "precionoche",
  "preciopornoche",
  "tarifa",
]);

// Columns holding the price for the same date one or two years earlier, as in
// a "price vs last year" report.
const shiftedPriceHeaders = new Map([
  ["lastyear", 1],
  ["pricelastyear", 1],
  ["anopasado", 1],
  ["preciodelanopasado", 1],
  ["2yearsago", 2],
  ["twoyearsago", 2],
  ["hace2anos", 2],
  ["haceunosdosanos", 2],
]);

const HEADER_SEARCH_ROWS = 25;

type SheetLayout = {
  headerRow: number;
  dateColumn: number;
  priceColumns: Array<{ column: number; yearsBack: number }>;
};

function findLayout(rows: ImportSheetRow[]): SheetLayout | null {
  for (let rowIndex = 0; rowIndex < Math.min(rows.length, HEADER_SEARCH_ROWS); rowIndex += 1) {
    const headers = rows[rowIndex].map((cell) => normalizeHeader(cell));
    const dateColumn = headers.findIndex((header) => dateHeaders.has(header));

    if (dateColumn < 0) {
      continue;
    }

    const priceColumns = headers.flatMap((header, column) => {
      if (priceHeaders.has(header)) {
        return [{ column, yearsBack: 0 }];
      }

      const yearsBack = shiftedPriceHeaders.get(header);
      return yearsBack ? [{ column, yearsBack }] : [];
    });

    if (priceColumns.length > 0) {
      return { headerRow: rowIndex, dateColumn, priceColumns };
    }
  }

  return null;
}

function readPrice(value: ImportCellValue) {
  if (value === null || value === undefined || String(value).trim() === "") {
    return null;
  }

  const parsed = parseMoney(value);
  return parsed.malformed || !Number.isFinite(parsed.value) || parsed.value <= 0 ? null : parsed.value;
}

/**
 * Reads every sheet that has a date column and at least one price column.
 * A price for the row's own date wins over one that came from a "last year"
 * column of a later row.
 */
export function parseNightlyPriceRows(sheets: Array<{ rows: ImportSheetRow[] }>): NightlyPriceInput[] {
  const direct = new Map<string, number>();
  const shifted = new Map<string, number>();

  for (const sheet of sheets) {
    const layout = findLayout(sheet.rows);

    if (!layout) {
      continue;
    }

    for (const row of sheet.rows.slice(layout.headerRow + 1)) {
      const dateKey = parseImportDate(row[layout.dateColumn]);

      if (!dateKey) {
        continue;
      }

      for (const { column, yearsBack } of layout.priceColumns) {
        const price = readPrice(row[column]);

        if (price === null) {
          continue;
        }

        if (yearsBack === 0) {
          direct.set(dateKey, price);
        } else {
          const targetKey = shiftDateKey(dateKey, -yearsBack);
          if (!shifted.has(targetKey)) {
            shifted.set(targetKey, price);
          }
        }
      }
    }
  }

  const merged = new Map(shifted);
  for (const [dateKey, price] of direct) {
    merged.set(dateKey, price);
  }

  return Array.from(merged, ([date, price]) => ({ date, price })).sort((left, right) =>
    left.date.localeCompare(right.date),
  );
}

export function parseNightlyPriceFile(buffer: ArrayBuffer, fileName: string) {
  return parseNightlyPriceRows(parseWorkbook(buffer, fileName).sheets);
}
