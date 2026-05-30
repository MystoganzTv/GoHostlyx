import { getBookings, getExpenses, getPropertyDefinitions, getUserSettings } from "@/lib/db";

export const defaultOnboardingPropertyName = "Main Property";

export async function getOnboardingState(
  ownerEmail: string,
  fallbackBusinessName: string,
) {
  const [userSettings, properties, bookings, expenses] = await Promise.all([
    getUserSettings(ownerEmail, fallbackBusinessName),
    getPropertyDefinitions(ownerEmail),
    getBookings(ownerEmail),
    getExpenses(ownerEmail),
  ]);

  const hasProperties = properties.length > 0;
  const hasData = bookings.length + expenses.length > 0;

  return {
    userSettings,
    properties,
    hasProperties,
    hasData,
    isComplete: hasProperties,
    defaultPropertyName: defaultOnboardingPropertyName,
  };
}
