import type { ImportCellValue, ImportSheetRow, RawImportRow } from "./types";

export const genericBookingColumns = {
  checkIn: ["checkin", "checkindate", "arrival", "fechadeinicio", "fechaentrada"],
  checkOut: ["checkout", "checkoutdate", "departure", "fechadefinalizacion", "fechadesalida"],
  guestName: ["guestname", "guest", "name", "huesped", "nombredelhuesped"],
  guests: ["ofguests", "guests", "guestcount", "numberofguests", "numerodehuespedes", "numerohuespedes", "huespedes", "nodehuespedes", "ndehuespedes"],
  channel: ["channel", "source", "canal", "fuente"],
  rentalPeriod: ["rentalperiod", "staylength", "estancia", "periododealquiler"],
  totalRevenue: ["totalrevenue", "grossrevenue", "ingresototal", "ingresobruto"],
  hostFee: ["hostfee", "platformfee", "servicefee", "comision", "tarifadeservicio"],
  cleaningFee: ["cleaningfee", "cleaning", "tarifadelimpieza", "limpieza"],
  taxAmount: ["tax", "taxes", "taxamount", "occupancytax", "vat", "iva", "impuestos", "tasas"],
  payout: ["payout", "netpayout", "ganancias", "pagoneto"],
  bookingReference: ["bookingnumber", "bookingreference", "reservationid", "codigodereserva"],
  propertyName: [
    "propertyname",
    "property",
    "listing",
    "listingname",
    "unitname",
    "alojamiento",
    "anuncio",
    "propiedad",
  ],
  status: ["overbookingstatus", "status", "estado"],
} as const;

export const genericBookingRequiredColumns = {
  checkIn: genericBookingColumns.checkIn,
  checkOut: genericBookingColumns.checkOut,
  guestName: genericBookingColumns.guestName,
  totalRevenue: genericBookingColumns.totalRevenue,
  payout: genericBookingColumns.payout,
} as const;

export const genericExpenseColumns = {
  date: ["date", "fecha"],
  category: ["category", "categoria"],
  amount: ["amount", "importe", "monto", "coste", "costo"],
  description: ["description", "descripcion", "concepto"],
  note: ["note", "nota", "comentario"],
  propertyName: [
    "propertyname",
    "property",
    "listing",
    "listingname",
    "unitname",
    "alojamiento",
    "anuncio",
    "propiedad",
  ],
} as const;

export const genericExpenseRequiredColumns = {
  date: genericExpenseColumns.date,
  category: genericExpenseColumns.category,
  amount: genericExpenseColumns.amount,
} as const;

export const airbnbBookingColumns = {
  bookingReference: [
    "confirmationcode",
    "confirmationnumber",
    "confirmation",
    "bookingreference",
    "reservationcode",
    "reservationid",
    "codigodeconfirmacion",
    "numerodeconfirmacion",
    "codigodereserva",
  ],
  guestName: [
    "guest",
    "guestname",
    "bookedby",
    "primaryguest",
    "name",
    "huesped",
    "nombredelhuesped",
    "huespedprincipal",
    "reservadopor",
  ],
  propertyName: [
    "listing",
    "listingname",
    "listingtitle",
    "property",
    "propertyname",
    "anuncio",
    "nombredelanuncio",
    "alojamiento",
  ],
  checkIn: [
    "checkin",
    "checkindate",
    "arrival",
    "arrivaldate",
    "startdate",
    "tripstartdate",
    "fechadeinicio",
    "fechaentrada",
  ],
  checkOut: [
    "checkout",
    "checkoutdate",
    "departure",
    "departuredate",
    "enddate",
    "tripenddate",
    "fechadefinalizacion",
    "fechadesalida",
  ],
  nights: ["nights", "nightcount", "lengthofstay", "numberofnights", "ofnights"],
  payout: [
    "payout",
    "netpayout",
    "earnings",
    "earning",
    "hostearnings",
    "yourearnings",
    "hostpayout",
    "expectedpayout",
    "ganancias",
    "ingresonetodelanfitrion",
    "pagonetorecibido",
  ],
  grossRevenue: [
    "grossrevenue",
    "grossbookingvalue",
    "bookingvalue",
    "subtotal",
    "paidbyguest",
    "guestpaid",
    "reservationvalue",
    "ingresobruto",
    "importetotal",
    "pagadoporelhuesped",
    "valordelareserva",
  ],
  platformFee: [
    "hostfee",
    "servicefee",
    "hostservicefee",
    "airbnbservicefee",
    "hostservicefeeamount",
    "tarifadeserviciodelanfitrion",
    "cuotadeserviciodelanfitrion",
    "tarifadeservicio",
    "comision",
  ],
  cleaningFee: ["cleaningfee", "cleaning", "tarifadelimpieza", "limpieza"],
  taxAmount: [
    "tax",
    "taxes",
    "taxamount",
    "occupancytax",
    "occupancytaxes",
    "lodgingtax",
    "vat",
    "iva",
    "impuestos",
    "impuestossobrelasreservas",
    "tasas",
  ],
  guests: ["guests", "guestcount", "numberofguests", "numerodehuespedes", "numerohuespedes", "huespedes", "nodehuespedes", "ndehuespedes"],
  guestContact: ["contact", "guestcontact", "phone", "phonenumber", "telefono", "tel"],
  bookedAt: ["booked", "bookingdate", "bookeddate", "reservationdate", "fechadereserva", "fechareserva"],
  adultsCount: ["ofadults", "adults", "adultcount", "adultscount", "numberofadults", "adultos", "numerodeadultos"],
  childrenCount: ["ofchildren", "children", "childcount", "childrencount", "numberofchildren", "ninos", "niños", "numerodeninos", "numerodeniños"],
  infantsCount: ["ofinfants", "infants", "infantcount", "infantscount", "numberofinfants", "bebes", "bebés", "numerodebebes", "numerodebebés"],
  status: ["status", "reservationstatus", "estado"],
  currency: ["currency", "currencycode", "moneda"],
} as const;

export const bookingComBookingColumns = {
  bookingReference: [
    "reservationnumber",
    "reservationno",
    "reservationid",
    "reservation",
    "bookingnumber",
    "bookingreference",
    "confirmationnumber",
    "numerodereserva",
    "codigodereserva",
  ],
  guestName: [
    "guestname",
    "guest",
    "bookername",
    "customername",
    "name",
    "huesped",
    "nombredelhuesped",
    "nombredelcliente",
  ],
  propertyName: [
    "accommodation",
    "accommodationname",
    "property",
    "propertyname",
    "hotel",
    "hotelname",
    "listing",
    "listingname",
    "alojamiento",
    "propiedad",
  ],
  checkIn: ["arrival", "arrivaldate", "checkin", "checkindate", "fechadeinicio", "fechaentrada"],
  checkOut: ["departure", "departuredate", "checkout", "checkoutdate", "fechadefinalizacion", "fechadesalida"],
  nights: ["nights", "nightcount", "lengthofstay", "staylength", "noches"],
  payout: ["payout", "netpayout", "payableamount", "amounttopayout", "netamount", "pagoneto", "importeanetopagar"],
  grossRevenue: [
    "grossrevenue",
    "reservationamount",
    "bookingvalue",
    "totalprice",
    "price",
    "amount",
    "importedereserva",
    "preciototal",
    "importe",
  ],
  platformFee: ["commission", "commissionamount", "platformfee", "bookingcommission", "comision"],
  cleaningFee: ["cleaningfee", "cleaning", "cleaningcharge", "limpieza", "tarifadelimpieza"],
  taxAmount: ["tax", "taxes", "taxamount", "vat", "iva", "impuestos", "tasas"],
  guests: ["guests", "guestcount", "numberofguests", "occupancy", "numerodehuespedes", "numerohuespedes", "huespedes", "nodehuespedes", "ndehuespedes"],
  status: ["status", "reservationstatus", "bookingstatus", "estado"],
  currency: ["currency", "currencycode", "moneda"],
} as const;

export function normalizeHeader(value: ImportCellValue) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "");
}

export function rowIsEmpty(row: ImportSheetRow) {
  return row.every((cell) => String(cell ?? "").trim() === "");
}

function headerMatchesAlias(header: string, alias: string) {
  if (!header || !alias) {
    return false;
  }

  if (header === alias) {
    return true;
  }

  return alias.length >= 3 && header.includes(alias);
}

export function mapOptionalColumns<T extends string>(
  headers: ImportSheetRow,
  columns: Record<T, readonly string[]>,
) {
  const normalizedHeaders = headers.map((header) => normalizeHeader(header));
  const indexes: Partial<Record<T, number>> = {};

  for (const [key, aliases] of Object.entries(columns) as Array<[T, readonly string[]]>) {
    const index = normalizedHeaders.findIndex(
      (header) => aliases.some((alias) => headerMatchesAlias(header, alias)),
    );
    if (index >= 0) {
      indexes[key] = index;
    }
  }

  return indexes;
}

export function mapRequiredColumns<T extends string>(
  headers: ImportSheetRow,
  columns: Record<T, readonly string[]>,
) {
  const normalizedHeaders = headers.map((header) => normalizeHeader(header));

  return Object.fromEntries(
    (Object.entries(columns) as Array<[T, readonly string[]]>).map(([key, aliases]) => {
      const index = normalizedHeaders.findIndex(
        (header) => aliases.some((alias) => headerMatchesAlias(header, alias)),
      );
      if (index < 0) {
        throw new Error(`Missing required column: ${key}`);
      }

      return [key, index];
    }),
  ) as Record<T, number>;
}

export function findHeaderRowIndex<T extends string>(
  rows: ImportSheetRow[],
  columns: Record<T, readonly string[]>,
) {
  for (let index = 0; index < Math.min(rows.length, 12); index += 1) {
    try {
      mapRequiredColumns(rows[index], columns);
      return index;
    } catch {
      continue;
    }
  }

  return -1;
}

export function getCell(row: ImportSheetRow, index: number | undefined) {
  return typeof index === "number" ? row[index] : "";
}

export function toRawRow(headers: ImportSheetRow, row: ImportSheetRow): RawImportRow {
  return Object.fromEntries(
    headers.map((header, index) => {
      const key = String(header ?? "").trim() || `column_${index + 1}`;
      const value = row[index];

      if (typeof value === "number") {
        return [key, value];
      }

      const normalized = String(value ?? "").trim();
      return [key, normalized || null];
    }),
  );
}
