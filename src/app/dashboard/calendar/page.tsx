import {
  eachMonthOfInterval,
  format,
  parseISO,
  startOfMonth,
} from "date-fns";
import { redirect } from "next/navigation";
import { CalendarPanel } from "@/components/calendar-panel";
import { FilterBar } from "@/components/filter-bar";
import { WorkspaceShell } from "@/components/workspace-shell";
import { getAuthSession } from "@/lib/auth";
import { getDashboardFilters } from "@/lib/dashboard";
import {
  getBookings,
  getCalendarClosures,
  getLatestImport,
  getPropertyDefinitions,
  getUserSettings,
} from "@/lib/db";
import { getServerLocale, getTranslations } from "@/lib/i18n";
import { getCurrencyForCountry } from "@/lib/markets";

export const runtime = "nodejs";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function getCalendarMonthAnchors(
  bookings: Awaited<ReturnType<typeof getBookings>>,
  closures: Awaited<ReturnType<typeof getCalendarClosures>>,
  year: number | "all",
  month: number | "all",
) {
  const allDates = [
    ...bookings.map((booking) => parseISO(booking.checkIn)),
    ...bookings.map((booking) => parseISO(booking.checkout)),
    ...closures.map((closure) => parseISO(closure.date)),
  ].filter((date) => !Number.isNaN(date.getTime()));

  if (year !== "all" && month !== "all") {
    return [new Date(year, month - 1, 1)];
  }

  if (year !== "all") {
    return Array.from({ length: 12 }, (_, index) => new Date(year, index, 1));
  }

  const availableYears = Array.from(
    new Set(allDates.map((date) => date.getFullYear())),
  ).sort((left, right) => left - right);

  if (month !== "all") {
    if (availableYears.length === 0) {
      return [new Date(new Date().getFullYear(), month - 1, 1)];
    }

    return availableYears.map((availableYear) => new Date(availableYear, month - 1, 1));
  }

  if (allDates.length === 0) {
    return [startOfMonth(new Date())];
  }

  const sortedDates = allDates.sort((left, right) => left.getTime() - right.getTime());

  return eachMonthOfInterval({
    start: startOfMonth(sortedDates[0]),
    end: startOfMonth(sortedDates.at(-1) ?? new Date()),
  });
}

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const locale = await getServerLocale();
  const t = getTranslations(locale);
  const session = await getAuthSession();
  const ownerEmail = session?.user?.email?.toLowerCase();

  if (!session?.user?.email || !ownerEmail) {
    redirect("/login");
  }

  const userName = session.user.name ?? session.user.email ?? "Host";
  const properties = await getPropertyDefinitions(ownerEmail);

  if (properties.length === 0) {
    redirect("/dashboard/properties?setup=1");
  }

  const [bookings, closures, latestImport, userSettings, resolvedSearchParams] = await Promise.all([
    getBookings(ownerEmail),
    getCalendarClosures(ownerEmail),
    getLatestImport(ownerEmail),
    getUserSettings(ownerEmail, userName),
    searchParams,
  ]);

  const filters = getDashboardFilters(
    resolvedSearchParams,
    bookings,
    [],
    properties,
    userSettings.primaryCountryCode,
  );
  const propertyCountryMap = new Map(
    properties.map((property) => [property.name.trim().toLowerCase(), property.countryCode]),
  );

  const countryAndChannelBookings = bookings.filter((booking) => {
    const countryCode =
      propertyCountryMap.get(booking.propertyName.trim().toLowerCase()) ??
      userSettings.primaryCountryCode;

    return (
      (filters.countryCode === "all" || countryCode === filters.countryCode) &&
      (filters.channel === "all" || booking.channel === filters.channel)
    );
  });

  const countryClosures = closures.filter((closure) => {
    const countryCode =
      propertyCountryMap.get(closure.propertyName.trim().toLowerCase()) ??
      userSettings.primaryCountryCode;

    return filters.countryCode === "all" || countryCode === filters.countryCode;
  });

  const monthAnchors = getCalendarMonthAnchors(
    countryAndChannelBookings,
    countryClosures,
    filters.year,
    filters.month,
  );

  const displayCountryCode =
    filters.countryCode === "all" ? userSettings.primaryCountryCode : filters.countryCode;
  const currencyCode = getCurrencyForCountry(displayCountryCode);
  const rangeLabel =
    filters.year === "all"
      ? filters.month === "all"
        ? "All imported months"
        : `Every ${format(new Date(2000, filters.month - 1, 1), "MMMM")}`
      : filters.month === "all"
        ? String(filters.year)
        : format(new Date(filters.year, filters.month - 1, 1), "MMMM yyyy");

  return (
    <WorkspaceShell
      activePage="calendar"
      pageTitle={t("page.calendar.title")}
      pageSubtitle={t("page.calendar.subtitle")}
      businessName={userSettings.businessName}
      userName={userName}
      userEmail={ownerEmail}
      currencyCode={currencyCode}
      latestImport={latestImport}
      actions={
        <FilterBar
          mode="calendar"
          years={Array.from(
            new Set([
              ...bookings.map((booking) => parseISO(booking.checkIn).getFullYear()),
              ...closures.map((closure) => parseISO(closure.date).getFullYear()),
            ]),
          ).sort((a, b) => b - a)}
          channels={Array.from(new Set(bookings.map((booking) => booking.channel))).sort((a, b) =>
            a.localeCompare(b),
          )}
          countries={Array.from(new Set(properties.map((property) => property.countryCode)))}
          selectedYear={filters.year}
          selectedMonth={filters.month}
          selectedChannel={filters.channel}
          selectedCountryCode={filters.countryCode}
        />
      }
    >
      <CalendarPanel
        rangeLabel={rangeLabel}
        bookings={countryAndChannelBookings}
        closures={countryClosures}
        monthAnchors={monthAnchors}
      />
    </WorkspaceShell>
  );
}
