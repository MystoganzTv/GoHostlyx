import * as XLSX from "xlsx";
import { normalizeHeader } from "./columnMatchers";
import type { ImportSheetRow, ParsedImportWorkbook } from "./types";

function looksLikeMojibake(text: string) {
  return /Ã.|â.|�/.test(text);
}

function decodeCsvBuffer(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  const utf8 = new TextDecoder("utf-8", { fatal: false }).decode(bytes);

  if (!looksLikeMojibake(utf8)) {
    return utf8;
  }

  try {
    return new TextDecoder("windows-1252", { fatal: false }).decode(bytes);
  } catch {
    return utf8;
  }
}

function getSheetRows(sheet: XLSX.WorkSheet) {
  return XLSX.utils.sheet_to_json<ImportSheetRow>(sheet, {
    header: 1,
    raw: true,
    defval: "",
    blankrows: false,
  });
}

function parseCsvText(text: string): ImportSheetRow[] {
  const rows: ImportSheetRow[] = [];
  let currentRow: ImportSheetRow = [];
  let currentCell = "";
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    const nextCharacter = text[index + 1];

    if (inQuotes) {
      if (character === '"' && nextCharacter === '"') {
        currentCell += '"';
        index += 1;
      } else if (character === '"') {
        inQuotes = false;
      } else {
        currentCell += character;
      }

      continue;
    }

    if (character === '"') {
      inQuotes = true;
      continue;
    }

    if (character === ",") {
      currentRow.push(currentCell);
      currentCell = "";
      continue;
    }

    if (character === "\n") {
      currentRow.push(currentCell);
      rows.push(currentRow);
      currentRow = [];
      currentCell = "";
      continue;
    }

    if (character === "\r") {
      continue;
    }

    currentCell += character;
  }

  if (currentCell !== "" || currentRow.length > 0) {
    currentRow.push(currentCell);
    rows.push(currentRow);
  }

  return rows.filter((row) => row.some((cell) => String(cell ?? "").trim() !== ""));
}

export function parseWorkbook(buffer: ArrayBuffer, fileName: string): ParsedImportWorkbook {
  const isCsv = fileName.toLowerCase().endsWith(".csv");

  if (isCsv) {
    const baseName = fileName.replace(/\.[^.]+$/, "") || "Sheet1";
    return {
      fileName,
      sheets: [
        {
          name: baseName,
          normalizedName: normalizeHeader(baseName),
          rows: parseCsvText(decodeCsvBuffer(buffer)),
        },
      ],
    };
  }

  const workbook = XLSX.read(buffer, {
    type: "array",
    cellDates: true,
  });

  return {
    fileName,
    sheets: workbook.SheetNames.map((sheetName) => ({
      name: sheetName,
      normalizedName: normalizeHeader(sheetName),
      rows: getSheetRows(workbook.Sheets[sheetName]),
    })),
  };
}
