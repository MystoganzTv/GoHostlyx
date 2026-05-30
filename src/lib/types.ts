export type ImportSource = "demo" | "upload" | "manual";
export type ImportedFileSource =
  | "airbnb"
  | "booking_com"
  | "generic_excel"
  | "hostlyx_excel"
  | "financial_statement";
export type BookingMatchStatus =
  | "unmatched"
  | "matched_to_calendar"
  | "conflict_blocked_calendar";
export type BookingReviewStatus = "ready" | "needs_review";
export type CalendarEventSource = "airbnb" | "booking" | "vrbo" | "other";
export type CalendarEventType = "booking" | "blocked" | "unknown";
export type IcalFeedSyncStatus = "never" | "pending" | "success" | "error";
export type CurrencyCode = "USD" | "EUR" | "GBP";
export type CountryCode = "US" | "ES" | "GB";
export type SubscriptionPlan = "trial" | "starter" | "pro" | "portfolio";
export type SubscriptionStatus = "trialing" | "active" | "expired";
export type DashboardDateRangePreset =
  | "all-time"
  | "this-year"
  | "last-year"
  | "this-month"
  | "last-90-days"
  | "custom";
export type RevenueByChannelTotals = {
  airbnb: number;
  booking: number;
  other: number;
};

export type BookingRecord = {
  id?: number;
  importId?: number;
  source?: ImportSource;
  importedSource?: ImportedFileSource;
  propertyId?: number | null;
  propertyName: string;
  unitName: string;
  checkIn: string;
  checkout: string;
  guestName: string;
  guestCount: number;
  guestContact?: string;
  bookedAt?: string;
  adultsCount?: number;
  childrenCount?: number;
  infantsCount?: number;
  channel: string;
  rentalPeriod: string;
  pricePerNight: number;
  extraFee: number;
  discount: number;
  rentalRevenue: number;
  cleaningFee: number;
  taxAmount: number;
  totalRevenue: number;
  hostFee: number;
  payout: number;
  nights: number;
  bookingNumber: string;
  overbookingStatus: string;
  matchStatus?: BookingMatchStatus;
  matchedCalendarEventId?: number | null;
  reviewStatus?: BookingReviewStatus;
  reviewReason?: string;
};

export type ExpenseRecord = {
  id?: number;
  importId?: number;
  source?: ImportSource;
  propertyName: string;
  unitName: string;
  date: string;
  category: string;
  amount: number;
  description: string;
  note: string;
};

export type CalendarClosureRecord = {
  id?: number;
  importId?: number;
  source?: ImportSource;
  propertyName: string;
  unitName: string;
  date: string;
  reason: string;
  note: string;
  statusLabel: string;
  guestCount: number;
  nights: number;
};

export type CalendarEventRecord = {
  id?: number;
  importId?: number;
  icalFeedId?: number | null;
  propertyId?: number | null;
  propertyName: string;
  unitName: string;
  source: CalendarEventSource;
  externalEventId: string;
  summary: string;
  description: string;
  startDate: string;
  endDate: string;
  eventType: CalendarEventType;
  linkedBookingId?: number | null;
  lastSyncedAt: string;
};

export type IcalFeedRecord = {
  id?: number;
  workspaceId: string;
  propertyId: number;
  listingId?: number | null;
  propertyName: string;
  listingName: string;
  source: CalendarEventSource;
  feedUrl: string;
  isActive: boolean;
  lastSyncedAt?: string | null;
  lastSyncStatus: IcalFeedSyncStatus;
  lastError?: string | null;
  eventCount: number;
};

export type ImportSummary = {
  id: number;
  fileName: string;
  propertyName: string;
  source: ImportSource;
  importedSource: ImportedFileSource;
  importedAt: string;
  bookingsCount: number;
  expensesCount: number;
};

export type FinancialDocumentSource = "airbnb" | "booking";

export type FinancialDocumentRecord = {
  id?: number;
  importId?: number;
  propertyName: string;
  source: FinancialDocumentSource;
  period: {
    start: string;
    end: string;
    label: string;
  };
  totalPayout: number;
  totalFees: number;
  totalTaxes: number;
  currency: string;
  rawData: string;
  importedAt?: string;
};

export type ImportValidationWarning = {
  code: string;
  message: string;
};

export type ParsedImportSummary = {
  source: ImportedFileSource;
  sourceLabel: string;
  rowsImported: number;
  bookingsImported: number;
  payoutsDetected: number;
  feesDetected: number;
  skippedRows: number;
  warnings: ImportValidationWarning[];
};

export type UserSettings = {
  businessName: string;
  primaryCountryCode: CountryCode;
  currencyCode: CurrencyCode;
  taxCountryCode: CountryCode;
  taxRate: number;
};

export type SubscriptionState = {
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  trialStartedAt: string;
  trialEndsAt: string;
  activatedAt: string | null;
  updatedAt: string;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  stripePriceId: string | null;
};

export type AdminUserSummary = {
  ownerEmail: string;
  businessName: string;
  subscription: SubscriptionState;
  propertiesCount: number;
  importsCount: number;
  bookingsCount: number;
  expensesCount: number;
  isAdmin: boolean;
};

export type PropertyUnit = {
  id?: number;
  name: string;
};

export type PropertyDefinition = {
  id?: number;
  name: string;
  countryCode: CountryCode;
  units: PropertyUnit[];
};

export type DashboardFilters = {
  year: number | "all";
  month: number | "all";
  channel: string | "all";
  countryCode: CountryCode | "all";
  rangePreset: DashboardDateRangePreset;
  startDate: string;
  endDate: string;
};

export type MetricCard = {
  label: string;
  value: number;
  format: "currency" | "percent" | "number";
  changeLabel?: string;
};

export type MonthlyPoint = {
  key?: string;
  label: string;
  revenue: number;
  payout: number;
  expenses: number;
  profit: number;
  bookings: number;
  guests: number;
  nights: number;
};

export type CategoryPoint = {
  label: string;
  value: number;
};

export type ChannelPoint = {
  label: string;
  revenue: number;
  bookings: number;
};

export type DashboardView = {
  availableYears: number[];
  availableChannels: string[];
  availableCountries: CountryCode[];
  filters: DashboardFilters;
  rangeLabel: string;
  displayCurrencyCode: CurrencyCode;
  mixedCurrencyMode: boolean;
  marketBreakdown: Array<{
    countryCode: CountryCode;
    currencyCode: CurrencyCode;
    revenue: number;
    payout: number;
    expenses: number;
    profit: number;
    bookings: number;
    guests: number;
    nights: number;
  }>;
  reconcile: null | {
    source: FinancialDocumentSource;
    periodLabel: string;
    statementCount: number;
    expectedPayout: number;
    actualPayout: number;
    difference: number;
    mismatchRatio: number | null;
    grossRevenue: number;
    adjustments: number;
    totalFees: number;
    totalTaxes: number;
    currency: string;
    trustLabel: string;
    message: string;
    alertMessage: string | null;
    insights: Array<{
      title: string;
      body: string;
      tone: "neutral" | "caution" | "positive";
    }>;
  };
  metrics: {
    totalRevenue: number;
    totalPayout: number;
    grossRevenue: number;
    netPayout: number;
    totalExpenses: number;
    netProfit: number;
    profitMargin: number;
    bookingsCount: number;
    guestsCount: number;
    nightsBooked: number;
    adr: number;
    occupancyRate: number;
    revPar: number;
    estimatedTaxes: number;
    profitAfterTax: number;
  };
  taxSettings: {
    countryCode: CountryCode;
    savedCountryCode: CountryCode;
    taxRate: number;
    suggestedTaxRate: number;
    usesSavedSettings: boolean;
    usesCustomRate: boolean;
  };
  revenueByMonth: MonthlyPoint[];
  profitByMonth: MonthlyPoint[];
  expensesByMonth: MonthlyPoint[];
  expensesByCategory: CategoryPoint[];
  revenueByChannel: ChannelPoint[];
  revenueByChannelTotals: RevenueByChannelTotals;
  recentBookings: BookingRecord[];
  recentExpenses: ExpenseRecord[];
  monthlySummary: MonthlyPoint[];
};
