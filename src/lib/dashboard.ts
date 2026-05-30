import {
  eachMonthOfInterval,
  endOfDay,
  endOfMonth,
  endOfYear,
  format,
  parseISO,
  startOfDay,
  startOfMonth,
  startOfYear,
  subDays,
  subYears,
} from "date-fns";
import { getDateFnsLocale, type AppLocale } from "./i18n";
import {
  calculateChannelData,
  calculateExpenseCategories,
  calculateMonthlyData,
  calculateTotals,
} from "./finance";
import { getCurrencyForCountry, normalizeCountryCode } from "./markets";
import { getAppliedTaxSettings } from "./tax";
import type {
  BookingRecord,
  CategoryPoint,
  CountryCode,
  DashboardDateRangePreset,
  DashboardFilters,
  DashboardView,
  ExpenseRecord,
  FinancialDocumentRecord,
  PropertyDefinition,
} from "./types";

type SearchParams = Record<string, string | string[] | undefined>;

function normalizeDateInput(value: string | undefined) {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : "";
}

function getDateBounds(bookings: BookingRecord[], expenses: ExpenseRecord[]) {
  const allDates = [
    ...bookings.map((booking) => parseISO(booking.checkIn)),
    ...expenses.map((expense) => parseISO(expense.date)),
  ].filter((date) => !Number.isNaN(date.getTime()));

  if (allDates.length === 0) {
    const today = new Date();

    return {
      earliestDate: startOfMonth(today),
      latestDate: endOfDay(today),
    };
  }

  return {
    earliestDate: new Date(Math.min(...allDates.map((date) => date.getTime()))),
    latestDate: new Date(Math.max(...allDates.map((date) => date.getTime()))),
  };
}

function createPropertyCountryMap(
  properties: PropertyDefinition[],
  fallbackCountryCode: CountryCode,
) {
  return new Map(
    properties.map((property) => [
      property.name.trim().toLowerCase(),
      normalizeCountryCode(property.countryCode ?? fallbackCountryCode),
    ]),
  );
}

function resolveRecordCountryCode(
  propertyName: string,
  propertyCountryMap: Map<string, CountryCode>,
  fallbackCountryCode: CountryCode,
) {
  return propertyCountryMap.get(propertyName.trim().toLowerCase()) ?? fallbackCountryCode;
}

function getRangeFromYearMonth(
  year: number | "all",
  month: number | "all",
  bookings: BookingRecord[],
  expenses: ExpenseRecord[],
  locale: AppLocale = "en",
) {
  const { earliestDate, latestDate } = getDateBounds(bookings, expenses);
  const dateFnsLocale = getDateFnsLocale(locale);
  const isSpanish = locale === "es";

  if (year === "all") {
    return {
      start: startOfMonth(earliestDate),
      end: endOfMonth(latestDate),
      label: isSpanish ? "Todos los meses importados" : "All imported months",
    };
  }

  if (month === "all") {
    const anchor = new Date(year, 0, 1);
    return {
      start: startOfYear(anchor),
      end: endOfYear(anchor),
      label: String(year),
    };
  }

  const anchor = new Date(year, month - 1, 1);
  return {
    start: startOfMonth(anchor),
    end: endOfMonth(anchor),
    label: format(anchor, "MMMM yyyy", { locale: dateFnsLocale }),
  };
}

function getRangeFromFilters(
  filters: DashboardFilters,
  bookings: BookingRecord[],
  expenses: ExpenseRecord[],
  locale: AppLocale = "en",
) {
  const { earliestDate, latestDate } = getDateBounds(bookings, expenses);
  const today = new Date();
  const dateFnsLocale = getDateFnsLocale(locale);
  const isSpanish = locale === "es";

  if (filters.rangePreset === "this-year") {
    return {
      start: startOfYear(today),
      end: endOfDay(today),
      label: isSpanish ? "Este año" : "This year",
    };
  }

  if (filters.rangePreset === "last-year") {
    const lastYear = subYears(today, 1);

    return {
      start: startOfYear(lastYear),
      end: endOfYear(lastYear),
      label: isSpanish ? "Año pasado" : "Last year",
    };
  }

  if (filters.rangePreset === "this-month") {
    return {
      start: startOfMonth(today),
      end: endOfDay(today),
      label: isSpanish ? "Este mes" : "This month",
    };
  }

  if (filters.rangePreset === "last-90-days") {
    return {
      start: startOfDay(subDays(today, 89)),
      end: endOfDay(today),
      label: isSpanish ? "Últimos 90 días" : "Last 90 days",
    };
  }

  if (filters.rangePreset === "custom") {
    const startCandidate = normalizeDateInput(filters.startDate);
    const endCandidate = normalizeDateInput(filters.endDate);
    const parsedStart = startCandidate ? parseISO(startCandidate) : earliestDate;
    const parsedEnd = endCandidate ? parseISO(endCandidate) : latestDate;
    const safeStart =
      Number.isNaN(parsedStart.getTime()) ? startOfDay(earliestDate) : startOfDay(parsedStart);
    const safeEnd =
      Number.isNaN(parsedEnd.getTime()) ? endOfDay(latestDate) : endOfDay(parsedEnd);
    const start = safeStart <= safeEnd ? safeStart : safeEnd;
    const end = safeStart <= safeEnd ? safeEnd : safeStart;

    return {
      start,
      end,
      label: isSpanish
        ? `${format(start, "d MMM yyyy", { locale: dateFnsLocale })} - ${format(end, "d MMM yyyy", { locale: dateFnsLocale })}`
        : `${format(start, "MMM d, yyyy", { locale: dateFnsLocale })} - ${format(end, "MMM d, yyyy", { locale: dateFnsLocale })}`,
    };
  }

  if (filters.rangePreset === "all-time") {
    return {
      start: startOfMonth(earliestDate),
      end: endOfMonth(latestDate),
      label: isSpanish ? "Todo el tiempo" : "All time",
    };
  }

  return getRangeFromYearMonth(filters.year, filters.month, bookings, expenses, locale);
}

function matchesDateFilter(dateValue: string, range: { start: Date; end: Date }) {
  const date = parseISO(dateValue);

  if (Number.isNaN(date.getTime())) {
    return false;
  }

  return date >= range.start && date <= range.end;
}

function clampRatio(value: number) {
  if (!Number.isFinite(value) || value < 0) {
    return 0;
  }

  return Math.min(value, 1);
}

function formatWholePercent(value: number) {
  return `${Math.round(Math.abs(value) * 100)}%`;
}

function buildReconcileInsights({
  expectedPayout,
  totalFees,
  totalTaxes,
  adjustments,
  mismatchRatio,
  locale,
}: {
  expectedPayout: number;
  totalFees: number;
  totalTaxes: number;
  adjustments: number;
  mismatchRatio: number | null;
  locale: AppLocale;
}) {
  const isSpanish = locale === "es";
  const insights: Array<{
    title: string;
    body: string;
    tone: "neutral" | "caution" | "positive";
  }> = [];

  if (expectedPayout > 0 && totalFees > expectedPayout * 0.18) {
    insights.push({
      title: isSpanish ? "Las comisiones de plataforma están altas" : "Platform fees are elevated",
      body: isSpanish
        ? "El statement muestra un impacto por comisiones mayor de lo que sugiere la vista de reservas."
        : "The statement shows a larger fee drag than the booking view would suggest.",
      tone: "caution",
    });
  }

  if (expectedPayout > 0 && totalTaxes > expectedPayout * 0.08) {
    insights.push({
      title: isSpanish ? "Se retuvieron impuestos en origen" : "Taxes were retained at source",
      body: isSpanish
        ? "Parte de la brecha del payout se explica por impuestos retenidos antes del pago."
        : "Part of the payout gap is being explained by taxes withheld before payout.",
      tone: "neutral",
    });
  }

  if (adjustments > Math.max(25, expectedPayout * 0.03)) {
    insights.push({
      title: isSpanish ? "Los ajustes están reduciendo el payout" : "Adjustments are reducing payout",
      body: isSpanish
        ? "El statement incluye deducciones más allá de comisiones e impuestos."
        : "The statement includes deductions beyond fees and taxes.",
      tone: "caution",
    });
  } else if (adjustments < -Math.max(25, expectedPayout * 0.03)) {
    insights.push({
      title: isSpanish ? "Se detectaron créditos en el statement" : "Statement credits were detected",
      body: isSpanish
        ? "El statement incluye ajustes positivos que elevan el payout por encima del modelo simple."
        : "The statement includes positive adjustments lifting the payout above the simple model.",
      tone: "positive",
    });
  }

  if (mismatchRatio !== null && mismatchRatio < -0.08) {
    insights.push({
      title: isSpanish ? "Posibles reservas faltantes" : "Possible missing bookings",
      body: isSpanish
        ? "El payout real está materialmente por debajo de la expectativa basada en reservas para esta vista."
        : "Actual payout is materially below the booking-based expectation for this view.",
      tone: "caution",
    });
  }

  if (insights.length === 0) {
    insights.push({
      title: isSpanish ? "Los payouts se ven alineados" : "Payouts look aligned",
      body: isSpanish
        ? "El statement coincide en líneas generales con lo que Hostlyx esperaba según los datos de reservas."
        : "The statement is broadly matching what Hostlyx expected from the booking data.",
      tone: "positive",
    });
  }

  return insights.slice(0, 4);
}

function buildReconcileMessage({
  difference,
  mismatchRatio,
  locale,
}: {
  difference: number;
  mismatchRatio: number | null;
  locale: AppLocale;
}) {
  const isSpanish = locale === "es";
  if (mismatchRatio === null || Math.abs(difference) < 1) {
    return isSpanish ? "Tus payouts coinciden con tus datos." : "Your payouts match your data.";
  }

  if (Math.abs(mismatchRatio) <= 0.03) {
    return isSpanish
      ? "Tus payouts están muy alineados con tus datos."
      : "Your payouts are closely aligned with your data.";
  }

  if (difference < 0) {
    return isSpanish
      ? `Recibiste ${formatWholePercent(mismatchRatio)} menos de lo esperado.`
      : `You received ${formatWholePercent(mismatchRatio)} less than expected.`;
  }

  return isSpanish
    ? `Recibiste ${formatWholePercent(mismatchRatio)} más de lo esperado.`
    : `You received ${formatWholePercent(mismatchRatio)} more than expected.`;
}

function rangesOverlap(
  left: { start: Date; end: Date },
  right: { start: Date; end: Date },
) {
  return left.start <= right.end && right.start <= left.end;
}

export function getDashboardFilters(
  searchParams: SearchParams,
  bookings: BookingRecord[],
  expenses: ExpenseRecord[],
  properties: PropertyDefinition[],
  fallbackCountryCode: CountryCode,
): DashboardFilters {
  const years = Array.from(
    new Set(
      [
        ...bookings.map((booking) => parseISO(booking.checkIn).getFullYear()),
        ...expenses.map((expense) => parseISO(expense.date).getFullYear()),
      ].filter((year) => !Number.isNaN(year)),
    ),
  ).sort((a, b) => b - a);

  const defaultYear = years[0] ?? new Date().getFullYear();

  const yearParam = Array.isArray(searchParams.year) ? searchParams.year[0] : searchParams.year;
  const monthParam = Array.isArray(searchParams.month) ? searchParams.month[0] : searchParams.month;
  const channelParam = Array.isArray(searchParams.channel) ? searchParams.channel[0] : searchParams.channel;
  const countryParam = Array.isArray(searchParams.country) ? searchParams.country[0] : searchParams.country;
  const rangeParam = Array.isArray(searchParams.range) ? searchParams.range[0] : searchParams.range;
  const startParam = Array.isArray(searchParams.start) ? searchParams.start[0] : searchParams.start;
  const endParam = Array.isArray(searchParams.end) ? searchParams.end[0] : searchParams.end;

  const year =
    yearParam === "all"
      ? "all"
      : Number.isFinite(Number(yearParam))
        ? Number(yearParam)
        : defaultYear;
  const month =
    monthParam === "all"
      ? "all"
      : Number.isFinite(Number(monthParam))
        ? Number(monthParam)
        : "all";

  const availableCountries = Array.from(
    new Set(properties.map((property) => normalizeCountryCode(property.countryCode ?? fallbackCountryCode))),
  );
  const defaultCountry = availableCountries[0] ?? fallbackCountryCode;
  const normalizedCountryCode =
    countryParam === "all" ? "all" : normalizeCountryCode(countryParam ?? defaultCountry);
  const startDate = normalizeDateInput(startParam);
  const endDate = normalizeDateInput(endParam);

  let rangePreset: DashboardDateRangePreset;

  if (
    rangeParam === "all-time" ||
    rangeParam === "this-year" ||
    rangeParam === "last-year" ||
    rangeParam === "this-month" ||
    rangeParam === "last-90-days" ||
    rangeParam === "custom"
  ) {
    rangePreset = rangeParam;
  } else if (yearParam || monthParam) {
    rangePreset = year === "all" && month === "all" ? "all-time" : "custom";
  } else {
    rangePreset = "all-time";
  }

  const legacyRange =
    rangeParam || (!yearParam && !monthParam)
      ? null
      : getRangeFromYearMonth(
          year,
          month !== "all" && (month < 1 || month > 12) ? "all" : month,
          bookings,
          expenses,
        );

  return {
    year,
    month: month !== "all" && (month < 1 || month > 12) ? "all" : month,
    channel: channelParam?.trim() ? channelParam : "all",
    countryCode: normalizedCountryCode,
    rangePreset,
    startDate: rangePreset === "custom" ? startDate || format(legacyRange?.start ?? new Date(), "yyyy-MM-dd") : "",
    endDate: rangePreset === "custom" ? endDate || format(legacyRange?.end ?? new Date(), "yyyy-MM-dd") : "",
  };
}

export function filterBookingsForFilters({
  bookings,
  filters,
  properties,
  fallbackCountryCode,
}: {
  bookings: BookingRecord[];
  filters: DashboardFilters;
  properties: PropertyDefinition[];
  fallbackCountryCode: CountryCode;
}) {
  const propertyCountryMap = createPropertyCountryMap(properties, fallbackCountryCode);
  const range = getRangeFromFilters(filters, bookings, []);

  return bookings
    .filter((booking) => {
      const countryCode = resolveRecordCountryCode(
        booking.propertyName,
        propertyCountryMap,
        fallbackCountryCode,
      );

      return filters.countryCode === "all" || countryCode === filters.countryCode;
    })
    .filter((booking) => matchesDateFilter(booking.checkIn, range))
    .filter((booking) => filters.channel === "all" || booking.channel === filters.channel);
}

export function filterExpensesForFilters({
  expenses,
  filters,
  properties,
  fallbackCountryCode,
}: {
  expenses: ExpenseRecord[];
  filters: DashboardFilters;
  properties: PropertyDefinition[];
  fallbackCountryCode: CountryCode;
}) {
  const propertyCountryMap = createPropertyCountryMap(properties, fallbackCountryCode);
  const range = getRangeFromFilters(filters, [], expenses);

  return expenses
    .filter((expense) => {
      const countryCode = resolveRecordCountryCode(
        expense.propertyName,
        propertyCountryMap,
        fallbackCountryCode,
      );

      return filters.countryCode === "all" || countryCode === filters.countryCode;
    })
    .filter((expense) => matchesDateFilter(expense.date, range));
}

export function buildDashboardView({
  bookings,
  expenses,
  financialDocuments = [],
  filters,
  properties,
  fallbackCountryCode,
  taxCountryCode,
  taxRate,
  locale = "en",
}: {
  bookings: BookingRecord[];
  expenses: ExpenseRecord[];
  financialDocuments?: FinancialDocumentRecord[];
  filters: DashboardFilters;
  properties: PropertyDefinition[];
  fallbackCountryCode: CountryCode;
  taxCountryCode: CountryCode;
  taxRate: number;
  locale?: AppLocale;
}): DashboardView {
  const isSpanish = locale === "es";
  const normalizedTaxCountryCode = normalizeCountryCode(taxCountryCode);
  const propertyCountryMap = createPropertyCountryMap(properties, fallbackCountryCode);
  const availableYears = Array.from(
    new Set(
      [
        ...bookings.map((booking) => parseISO(booking.checkIn).getFullYear()),
        ...expenses.map((expense) => parseISO(expense.date).getFullYear()),
      ].filter((year) => !Number.isNaN(year)),
    ),
  ).sort((a, b) => b - a);

  const availableChannels = Array.from(new Set(bookings.map((booking) => booking.channel))).sort((a, b) =>
    a.localeCompare(b),
  );
  const availableCountries = Array.from(
    new Set(
      properties.map((property) =>
        normalizeCountryCode(property.countryCode ?? fallbackCountryCode),
      ),
    ),
  );

  const countryFilteredBookings = bookings.filter((booking) => {
    const countryCode = resolveRecordCountryCode(
      booking.propertyName,
      propertyCountryMap,
      fallbackCountryCode,
    );

    return filters.countryCode === "all" || countryCode === filters.countryCode;
  });

  const countryFilteredExpenses = expenses.filter((expense) => {
    const countryCode = resolveRecordCountryCode(
      expense.propertyName,
      propertyCountryMap,
      fallbackCountryCode,
    );

    return filters.countryCode === "all" || countryCode === filters.countryCode;
  });

  const activeRange = getRangeFromFilters(
    filters,
    countryFilteredBookings,
    countryFilteredExpenses,
    locale,
  );
  const dateFilteredBookings = countryFilteredBookings.filter((booking) =>
    matchesDateFilter(booking.checkIn, activeRange),
  );

  const filteredBookings = dateFilteredBookings.filter(
    (booking) => filters.channel === "all" || booking.channel === filters.channel,
  );

  const filteredExpenses = countryFilteredExpenses.filter((expense) =>
    matchesDateFilter(expense.date, activeRange),
  );
  const monthlyRange = activeRange;
  const monthKeys = eachMonthOfInterval({
    start: monthlyRange.start,
    end: monthlyRange.end,
  }).map((month) => format(month, "yyyy-MM"));
  const useYearInLabel = new Set(monthKeys.map((key) => key.slice(0, 4))).size > 1;
  const appliedTaxSettings = getAppliedTaxSettings({
    selectedCountryCode: filters.countryCode,
    savedCountryCode: normalizedTaxCountryCode,
    savedTaxRate: taxRate,
  });
  const totals = calculateTotals(
    filteredBookings,
    filteredExpenses,
    appliedTaxSettings.taxRate,
  );
  const monthlyData = calculateMonthlyData(filteredBookings, filteredExpenses, {
    monthKeys,
    useYearInLabel,
  });
  const channelData = calculateChannelData(filteredBookings);
  const expenseCategoryTotals = calculateExpenseCategories(filteredExpenses);
  const guestsCount = filteredBookings.reduce(
    (sum, booking) => sum + booking.guestCount,
    0,
  );
  const rentalRevenue = filteredBookings.reduce(
    (sum, booking) => sum + booking.rentalRevenue,
    0,
  );

  const availableNights = Math.max(
    1,
    Math.round(
      (monthlyRange.end.getTime() - monthlyRange.start.getTime()) / (1000 * 60 * 60 * 24),
    ) + 1,
  );

  const marketBreakdownMap = new Map<
    CountryCode,
    {
      revenue: number;
      payout: number;
      expenses: number;
      profit: number;
      bookings: number;
      guests: number;
      nights: number;
    }
  >();

  for (const booking of filteredBookings) {
    const countryCode = resolveRecordCountryCode(
      booking.propertyName,
      propertyCountryMap,
      fallbackCountryCode,
    );
    const current = marketBreakdownMap.get(countryCode) ?? {
      revenue: 0,
      payout: 0,
      expenses: 0,
      profit: 0,
      bookings: 0,
      guests: 0,
      nights: 0,
    };

    current.revenue += booking.totalRevenue;
    current.payout += booking.payout;
    current.bookings += 1;
    current.guests += booking.guestCount;
    current.nights += booking.nights;
    marketBreakdownMap.set(countryCode, current);
  }

  for (const expense of filteredExpenses) {
    const countryCode = resolveRecordCountryCode(
      expense.propertyName,
      propertyCountryMap,
      fallbackCountryCode,
    );
    const current = marketBreakdownMap.get(countryCode) ?? {
      revenue: 0,
      payout: 0,
      expenses: 0,
      profit: 0,
      bookings: 0,
      guests: 0,
      nights: 0,
    };

    current.expenses += expense.amount;
    marketBreakdownMap.set(countryCode, current);
  }

  const marketBreakdown = Array.from(marketBreakdownMap.entries())
    .map(([countryCode, value]) => ({
      countryCode,
      currencyCode: getCurrencyForCountry(countryCode),
      revenue: value.revenue,
      payout: value.payout,
      expenses: value.expenses,
      profit: value.payout - value.expenses,
      bookings: value.bookings,
      guests: value.guests,
      nights: value.nights,
    }))
    .sort((left, right) => right.revenue - left.revenue);

  const displayCountryCode =
    filters.countryCode === "all" ? fallbackCountryCode : filters.countryCode;
  const displayCurrencyCode = getCurrencyForCountry(displayCountryCode);
  const expensesByCategory: CategoryPoint[] = Object.entries(expenseCategoryTotals)
    .map(([label, value]) => ({ label, value }))
    .sort((left, right) => right.value - left.value);

  const overlappingFinancialDocuments = financialDocuments.filter((document) => {
    if (!document.period.start || !document.period.end) {
      return false;
    }

    const start = parseISO(document.period.start);
    const end = parseISO(document.period.end);

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return false;
    }

    return rangesOverlap(activeRange, { start, end });
  });

  const actualStatementPayout = overlappingFinancialDocuments.reduce(
    (sum, document) => sum + document.totalPayout,
    0,
  );
  const actualStatementFees = overlappingFinancialDocuments.reduce(
    (sum, document) => sum + document.totalFees,
    0,
  );
  const actualStatementTaxes = overlappingFinancialDocuments.reduce(
    (sum, document) => sum + document.totalTaxes,
    0,
  );
  const latestStatement = overlappingFinancialDocuments[0] ?? null;
  const statementCount = overlappingFinancialDocuments.length;
  const reconcile =
    latestStatement && actualStatementPayout > 0
      ? (() => {
          const difference = actualStatementPayout - totals.totalPayout;
          const mismatchRatio =
            totals.totalPayout !== 0 ? difference / Math.abs(totals.totalPayout) : null;
          const adjustments =
            totals.totalRevenue - actualStatementFees - actualStatementTaxes - actualStatementPayout;
          const trustLabel =
            statementCount > 1
              ? isSpanish
                ? `Basado en ${statementCount} statements importados de ${
                    latestStatement.source === "airbnb" ? "Airbnb" : "Booking.com"
                  }`
                : `Based on ${statementCount} imported ${
                    latestStatement.source === "airbnb" ? "Airbnb" : "Booking.com"
                  } statements`
              : isSpanish
                ? `Basado en un statement importado de ${
                    latestStatement.source === "airbnb" ? "Airbnb" : "Booking.com"
                  }`
                : `Based on imported ${
                    latestStatement.source === "airbnb" ? "Airbnb" : "Booking.com"
                  } statement`;

          return {
            source: latestStatement.source,
            periodLabel:
              statementCount > 1
                ? isSpanish
                  ? `${statementCount} statements en vista`
                  : `${statementCount} statements in view`
                : latestStatement.period.label,
            statementCount,
            expectedPayout: totals.totalPayout,
            actualPayout: actualStatementPayout,
            difference,
            mismatchRatio,
            grossRevenue: totals.totalRevenue,
            adjustments,
            totalFees: actualStatementFees,
            totalTaxes: actualStatementTaxes,
            currency: latestStatement.currency || displayCurrencyCode,
            trustLabel,
            message: buildReconcileMessage({ difference, mismatchRatio, locale }),
            alertMessage:
              mismatchRatio !== null && Math.abs(mismatchRatio) > 0.08
                ? isSpanish
                  ? "Tus payouts difieren significativamente de tus ingresos esperados."
                  : "Your payouts differ significantly from your expected revenue."
                : null,
            insights: buildReconcileInsights({
              expectedPayout: totals.totalPayout,
              totalFees: actualStatementFees,
              totalTaxes: actualStatementTaxes,
              adjustments,
              mismatchRatio,
              locale,
            }),
          };
        })()
      : null;

  return {
    availableYears,
    availableChannels,
    availableCountries,
    filters,
    rangeLabel: monthlyRange.label,
    displayCurrencyCode,
    mixedCurrencyMode: filters.countryCode === "all" && availableCountries.length > 1,
    marketBreakdown,
    reconcile,
    metrics: {
      totalRevenue: totals.totalRevenue,
      totalPayout: totals.totalPayout,
      grossRevenue: totals.totalRevenue,
      netPayout: totals.totalPayout,
      totalExpenses: totals.totalExpenses,
      netProfit: totals.netProfit,
      profitMargin: totals.profitMargin,
      bookingsCount: totals.totalBookings,
      guestsCount,
      nightsBooked: totals.nightsBooked,
      adr: totals.adr,
      occupancyRate: clampRatio(totals.nightsBooked / availableNights),
      revPar: availableNights > 0 ? rentalRevenue / availableNights : 0,
      estimatedTaxes: totals.estimatedTaxes,
      profitAfterTax: totals.profitAfterTax,
    },
    taxSettings: {
      countryCode: appliedTaxSettings.countryCode,
      savedCountryCode: appliedTaxSettings.savedCountryCode,
      taxRate: appliedTaxSettings.taxRate,
      suggestedTaxRate: appliedTaxSettings.suggestedTaxRate,
      usesSavedSettings: appliedTaxSettings.usesSavedSettings,
      usesCustomRate: appliedTaxSettings.usesCustomRate,
    },
    revenueByMonth: monthlyData.revenueByMonth,
    profitByMonth: monthlyData.profitByMonth,
    expensesByMonth: monthlyData.expensesByMonth,
    expensesByCategory,
    revenueByChannel: channelData.chartData,
    revenueByChannelTotals: channelData.revenueByChannel,
    recentBookings: [...filteredBookings]
      .sort((left, right) => right.checkIn.localeCompare(left.checkIn))
      .slice(0, 6),
    recentExpenses: [...filteredExpenses]
      .sort((left, right) => right.date.localeCompare(left.date))
      .slice(0, 6),
    monthlySummary: monthlyData.monthlySummary,
  };
}
