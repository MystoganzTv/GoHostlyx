// Internal persistence types shared by the data layer (db.ts and friends).
// Extracted from db.ts as the first step toward splitting that module by
// concern (types / schema / queries-by-domain).

import type {
  BookingRecord,
  CalendarClosureRecord,
  CalendarEventRecord,
  CountryCode,
  ExpenseRecord,
  FinancialDocumentRecord,
  IcalFeedRecord,
  ImportSummary,
  SubscriptionPlan,
  SubscriptionStatus,
  UserSettings,
} from "./types";

export type StoredImport = ImportSummary & {
  ownerEmail: string;
  workbookHash: string;
};

export type StoredBooking = Required<BookingRecord> & {
  ownerEmail: string;
};

export type StoredCalendarEvent = Required<CalendarEventRecord> & {
  ownerEmail: string;
};

export type StoredIcalFeed = Required<Omit<IcalFeedRecord, "lastSyncedAt" | "lastError">> & {
  ownerEmail: string;
  lastSyncedAt: string | null;
  lastError: string | null;
};

export type StoredExpense = Required<ExpenseRecord> & {
  ownerEmail: string;
};

export type StoredCalendarClosure = Required<CalendarClosureRecord> & {
  ownerEmail: string;
};

export type StoredFinancialDocument = Required<FinancialDocumentRecord> & {
  ownerEmail: string;
};

export type StoredUserSettings = UserSettings & {
  ownerEmail: string;
};

export type StoredAuthUser = {
  ownerEmail: string;
  fullName: string;
  passwordHash: string;
  isVerified: boolean;
  verificationCodeHash: string | null;
  verificationExpiresAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type StoredSubscription = {
  ownerEmail: string;
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

export type StoredProperty = {
  id: number;
  ownerEmail: string;
  name: string;
  countryCode: CountryCode;
};

export type StoredPropertyUnit = {
  id: number;
  propertyId: number;
  ownerEmail: string;
  name: string;
};

export type MemoryStore = {
  nextImportId: number;
  nextBookingId: number;
  nextExpenseId: number;
  nextClosureId: number;
  nextCalendarEventId: number;
  nextIcalFeedId: number;
  nextFinancialDocumentId: number;
  nextPropertyId: number;
  nextPropertyUnitId: number;
  imports: StoredImport[];
  bookings: StoredBooking[];
  expenses: StoredExpense[];
  closures: StoredCalendarClosure[];
  calendarEvents: StoredCalendarEvent[];
  icalFeeds: StoredIcalFeed[];
  financialDocuments: StoredFinancialDocument[];
  settings: StoredUserSettings[];
  authUsers: StoredAuthUser[];
  subscriptions: StoredSubscription[];
  properties: StoredProperty[];
  propertyUnits: StoredPropertyUnit[];
};
