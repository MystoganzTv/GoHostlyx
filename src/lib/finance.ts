import { differenceInCalendarDays, format, parseISO } from "date-fns";
import type {
  BookingRecord,
  ChannelPoint,
  ExpenseRecord,
  MonthlyPoint,
  RevenueByChannelTotals,
} from "./types";
import {
  calculateEstimatedTaxes,
  calculateProfitAfterTax,
  normalizeTaxRate,
} from "./tax";

function safeNumber(value: number | string | null | undefined) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number.parseFloat(value.replace(/[^0-9.-]/g, ""));
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

function getMonthKey(dateValue: string) {
  const parsed = parseISO(dateValue);
  return Number.isNaN(parsed.getTime()) ? null : format(parsed, "yyyy-MM");
}

function deriveBookingNights(booking: BookingRecord) {
  if (safeNumber(booking.nights) > 0) {
    return safeNumber(booking.nights);
  }

  if (safeNumber(booking.rentalPeriod) > 0) {
    return safeNumber(booking.rentalPeriod);
  }

  const checkIn = parseISO(booking.checkIn);
  const checkOut = parseISO(booking.checkout);

  if (Number.isNaN(checkIn.getTime()) || Number.isNaN(checkOut.getTime())) {
    return 0;
  }

  return Math.max(0, differenceInCalendarDays(checkOut, checkIn));
}

function normalizeChannelLabel(channel: string) {
  const normalized = channel.trim().toLowerCase();

  if (normalized.includes("airbnb")) {
    return "airbnb" as const;
  }

  if (normalized.includes("booking")) {
    return "booking" as const;
  }

  return "other" as const;
}

export function calculateTotals(
  bookings: BookingRecord[],
  expenses: ExpenseRecord[],
  taxRate: number,
) {
  const totalRevenue = bookings.reduce(
    (sum, booking) => sum + safeNumber(booking.totalRevenue),
    0,
  );
  const totalPayout = bookings.reduce(
    (sum, booking) => sum + safeNumber(booking.payout),
    0,
  );
  const totalExpenses = expenses.reduce(
    (sum, expense) => sum + safeNumber(expense.amount),
    0,
  );
  const totalBookings = bookings.length;
  const nightsBooked = bookings.reduce(
    (sum, booking) => sum + deriveBookingNights(booking),
    0,
  );
  const netProfit = totalPayout - totalExpenses;
  const adr = nightsBooked > 0 ? totalRevenue / nightsBooked : 0;
  const profitMargin = totalRevenue > 0 ? netProfit / totalRevenue : 0;
  const normalizedTaxRate = normalizeTaxRate(taxRate);
  const estimatedTaxes = calculateEstimatedTaxes(netProfit, normalizedTaxRate);
  const profitAfterTax = calculateProfitAfterTax(netProfit, normalizedTaxRate);

  return {
    totalRevenue,
    totalPayout,
    totalExpenses,
    netProfit,
    profitMargin,
    totalBookings,
    nightsBooked,
    adr,
    estimatedTaxes,
    profitAfterTax,
  };
}

export function calculateMonthlyData(
  bookings: BookingRecord[],
  expenses: ExpenseRecord[],
  options?: {
    monthKeys?: string[];
    useYearInLabel?: boolean;
  },
) {
  const monthOrder =
    options?.monthKeys && options.monthKeys.length > 0
      ? options.monthKeys
      : Array.from(
          new Set(
            [
              ...bookings.map((booking) => getMonthKey(booking.checkIn)),
              ...expenses.map((expense) => getMonthKey(expense.date)),
            ].filter((value): value is string => Boolean(value)),
          ),
        ).sort((left, right) => left.localeCompare(right));

  const monthMap = new Map<string, MonthlyPoint>();

  for (const key of monthOrder) {
    const [year, month] = key.split("-").map(Number);
    const labelDate = new Date(year, (month ?? 1) - 1, 1);
    monthMap.set(key, {
      key,
      label: format(labelDate, options?.useYearInLabel ? "MMM yyyy" : "MMM"),
      revenue: 0,
      payout: 0,
      expenses: 0,
      profit: 0,
      bookings: 0,
      guests: 0,
      nights: 0,
    });
  }

  for (const booking of bookings) {
    const key = getMonthKey(booking.checkIn);
    if (!key || !monthMap.has(key)) {
      continue;
    }

    const month = monthMap.get(key);
    if (!month) {
      continue;
    }

    month.revenue += safeNumber(booking.totalRevenue);
    month.payout += safeNumber(booking.payout);
    month.bookings += 1;
    month.guests += safeNumber(booking.guestCount);
    month.nights += deriveBookingNights(booking);
  }

  for (const expense of expenses) {
    const key = getMonthKey(expense.date);
    if (!key || !monthMap.has(key)) {
      continue;
    }

    const month = monthMap.get(key);
    if (!month) {
      continue;
    }

    month.expenses += safeNumber(expense.amount);
  }

  const monthlySummary = Array.from(monthMap.values()).map((month) => ({
    ...month,
    profit: month.payout - month.expenses,
  }));

  const revenueByMonth = monthlySummary.map((month) => ({
    ...month,
    profit: 0,
    expenses: 0,
  }));
  const profitByMonth = monthlySummary.map((month) => ({
    ...month,
    revenue: 0,
    expenses: 0,
  }));
  const expensesByMonth = monthlySummary.map((month) => ({
    ...month,
    revenue: 0,
    payout: 0,
    profit: 0,
  }));

  return {
    monthlySummary,
    revenueByMonth,
    profitByMonth,
    expensesByMonth,
  };
}

export function calculateChannelData(bookings: BookingRecord[]) {
  const revenueByChannel: RevenueByChannelTotals = {
    airbnb: 0,
    booking: 0,
    other: 0,
  };
  const chartMap = new Map<string, { revenue: number; bookings: number }>();

  for (const booking of bookings) {
    const revenue = safeNumber(booking.totalRevenue);
    const bucket = normalizeChannelLabel(booking.channel);
    revenueByChannel[bucket] += revenue;

    const label =
      bucket === "airbnb"
        ? "Airbnb"
        : bucket === "booking"
          ? "Booking"
          : booking.channel?.trim() || "Other";

    const current = chartMap.get(label) ?? { revenue: 0, bookings: 0 };
    current.revenue += revenue;
    current.bookings += 1;
    chartMap.set(label, current);
  }

  const chartData: ChannelPoint[] = Array.from(chartMap.entries())
    .map(([label, value]) => ({
      label,
      revenue: value.revenue,
      bookings: value.bookings,
    }))
    .sort((left, right) => right.revenue - left.revenue);

  return {
    revenueByChannel,
    chartData,
  };
}

export function calculateExpenseCategories(expenses: ExpenseRecord[]) {
  const expensesByCategory = expenses.reduce<Record<string, number>>((accumulator, expense) => {
    const key = expense.category?.trim() || "Uncategorized";
    accumulator[key] = (accumulator[key] ?? 0) + safeNumber(expense.amount);
    return accumulator;
  }, {});

  return expensesByCategory;
}
