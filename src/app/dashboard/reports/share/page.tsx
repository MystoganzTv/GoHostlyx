import Link from "next/link";
import { redirect } from "next/navigation";
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
import { canAccessReports } from "@/lib/subscription";
import { ShareReportPrintButton } from "@/components/share-report-print-button";
import { ShareReportSheet } from "@/components/share-report-sheet";

export const runtime = "nodejs";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function createBackHref(searchParams: Record<string, string | string[] | undefined>) {
  const query = new URLSearchParams();

  for (const [key, value] of Object.entries(searchParams)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        if (item) {
          query.append(key, item);
        }
      }

      continue;
    }

    if (value) {
      query.set(key, value);
    }
  }

  const search = query.toString();
  return search ? `/dashboard/reports?${search}` : "/dashboard/reports";
}

function createPdfHref(searchParams: Record<string, string | string[] | undefined>) {
  const query = new URLSearchParams();

  for (const [key, value] of Object.entries(searchParams)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        if (item) {
          query.append(key, item);
        }
      }

      continue;
    }

    if (value) {
      query.set(key, value);
    }
  }

  const search = query.toString();
  return search ? `/dashboard/reports/share/pdf?${search}` : "/dashboard/reports/share/pdf";
}

export default async function SharedReportPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
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

  const [bookings, expenses, latestImport, userSettings, resolvedSearchParams, subscription] = await Promise.all([
    getBookings(ownerEmail),
    getExpenses(ownerEmail),
    getLatestImport(ownerEmail),
    getUserSettings(ownerEmail, userName),
    searchParams,
    getSubscriptionState(ownerEmail),
  ]);

  if (!canAccessReports(subscription)) {
    redirect("/dashboard/reports");
  }

  const filters = getDashboardFilters(
    resolvedSearchParams,
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
  const generatedAt = formatDateLabel(new Date().toISOString().slice(0, 10));
  const backHref = createBackHref(resolvedSearchParams);
  const pdfHref = createPdfHref(resolvedSearchParams);

  return (
    <main className="report-print-shell min-h-screen bg-[#eef3f7] px-4 py-6 text-slate-950 sm:px-6 sm:py-8">
      <div className="report-print-hide mx-auto mb-6 flex w-full max-w-5xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            Share Report
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Use this view when you need something clean enough to send to an accountant, partner, or investor.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Link
            href={backHref}
            className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
          >
            Back to reports
          </Link>
          <ShareReportPrintButton
            href={pdfHref}
            className="rounded-2xl border border-[#7bd8ca] bg-[#8ce6d8] px-5 py-3 text-sm font-semibold text-[#0b2e2a] shadow-[0_12px_30px_rgba(74,222,200,0.18)] transition hover:border-[#6fd1c2] hover:bg-[#9aede0]"
          />
        </div>
      </div>

      <ShareReportSheet
        businessName={userSettings.businessName}
        view={view}
        generatedAt={generatedAt}
        latestImportFileName={latestImport?.fileName ?? null}
      />
    </main>
  );
}
