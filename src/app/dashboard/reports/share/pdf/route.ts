import { NextRequest, NextResponse } from "next/server";
import { buildDashboardView, getDashboardFilters } from "@/lib/dashboard";
import { getAuthSession } from "@/lib/auth";
import {
  getBookings,
  getExpenses,
  getLatestImport,
  getPropertyDefinitions,
  getSubscriptionState,
  getUserSettings,
} from "@/lib/db";
import { formatDateLabel } from "@/lib/format";
import { generateShareReportPdf } from "@/lib/report-pdf";
import { canAccessReports } from "@/lib/subscription";

export const runtime = "nodejs";

function searchParamsToRecord(searchParams: URLSearchParams) {
  const record: Record<string, string | string[] | undefined> = {};

  for (const key of searchParams.keys()) {
    const values = searchParams.getAll(key).filter(Boolean);

    if (values.length === 0) {
      continue;
    }

    record[key] = values.length === 1 ? values[0] : values;
  }

  return record;
}

function createFileName(businessName: string, generatedAt: string) {
  const slug = businessName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "hostlyx-report";

  return `${slug}-financial-summary-${generatedAt}.pdf`;
}

export async function GET(request: NextRequest) {
  const session = await getAuthSession();
  const ownerEmail = session?.user?.email?.toLowerCase();

  if (!session?.user?.email || !ownerEmail) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const userName = session.user.name ?? session.user.email ?? "Host";
  const properties = await getPropertyDefinitions(ownerEmail);

  if (properties.length === 0) {
    return NextResponse.redirect(new URL("/dashboard/properties?setup=1", request.url));
  }

  const [bookings, expenses, latestImport, userSettings, subscription] = await Promise.all([
    getBookings(ownerEmail),
    getExpenses(ownerEmail),
    getLatestImport(ownerEmail),
    getUserSettings(ownerEmail, userName),
    getSubscriptionState(ownerEmail),
  ]);

  if (!canAccessReports(subscription)) {
    return NextResponse.redirect(new URL("/dashboard/reports", request.url));
  }

  const searchParams = searchParamsToRecord(request.nextUrl.searchParams);
  const filters = getDashboardFilters(
    searchParams,
    bookings,
    expenses,
    properties,
    userSettings.primaryCountryCode,
  );
  const view = buildDashboardView({
    bookings,
    expenses,
    filters,
    properties,
    fallbackCountryCode: userSettings.primaryCountryCode,
    taxCountryCode: userSettings.taxCountryCode,
    taxRate: userSettings.taxRate,
  });

  const generatedAtIso = new Date().toISOString().slice(0, 10);
  const generatedAtLabel = formatDateLabel(generatedAtIso);
  const pdfBytes = await generateShareReportPdf({
    businessName: userSettings.businessName,
    generatedAt: generatedAtLabel,
    latestImportFileName: latestImport?.fileName ?? null,
    view,
  });

  return new Response(Buffer.from(pdfBytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${createFileName(userSettings.businessName, generatedAtIso)}"`,
      "Cache-Control": "private, no-store, max-age=0",
    },
  });
}
