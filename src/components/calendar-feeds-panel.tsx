"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { formatDistanceToNowStrict, parseISO } from "date-fns";
import { Link2, RefreshCw, Trash2 } from "lucide-react";
import { useLocale } from "@/components/locale-provider";
import { getDateFnsLocale } from "@/lib/i18n";
import type { IcalFeedRecord } from "@/lib/types";

function getSourceLabel(source: IcalFeedRecord["source"], locale: "en" | "es") {
  if (source === "booking") {
    return "Booking.com";
  }

  if (source === "vrbo") {
    return "Vrbo";
  }

  if (source === "other") {
    return locale === "es" ? "Otro" : "Other";
  }

  return "Airbnb";
}

function getStatusTone(status: IcalFeedRecord["lastSyncStatus"]) {
  if (status === "success") {
    return "border-emerald-300/18 bg-emerald-400/10 text-emerald-50";
  }

  if (status === "error") {
    return "border-rose-300/18 bg-rose-400/10 text-rose-50";
  }

  if (status === "pending") {
    return "border-amber-300/18 bg-amber-400/10 text-amber-50";
  }

  return "border-white/10 bg-white/[0.04] text-[var(--workspace-muted)]";
}

function getStatusLabel(feed: IcalFeedRecord, locale: "en" | "es") {
  if (feed.lastSyncStatus === "success") {
    return locale === "es" ? "Sincronizado" : "Synced";
  }

  if (feed.lastSyncStatus === "error") {
    return "Error";
  }

  if (feed.lastSyncStatus === "pending") {
    return locale === "es" ? "Sincronizando" : "Syncing";
  }

  return locale === "es" ? "Nunca sincronizado" : "Never synced";
}

function formatLastSynced(value: string | null | undefined, locale: "en" | "es") {
  if (!value) {
    return locale === "es" ? "Aún sin sincronizar" : "Not synced yet";
  }

  const parsed = parseISO(value);

  if (Number.isNaN(parsed.getTime())) {
    return locale === "es" ? "Aún sin sincronizar" : "Not synced yet";
  }

  return formatDistanceToNowStrict(parsed, {
    addSuffix: true,
    locale: getDateFnsLocale(locale),
  });
}

function maskFeedUrl(feedUrl: string) {
  try {
    const parsedUrl = new URL(feedUrl);
    return `${parsedUrl.hostname}${parsedUrl.pathname}`;
  } catch {
    return feedUrl;
  }
}

export function CalendarFeedsManager({
  feeds,
}: {
  feeds: IcalFeedRecord[];
}) {
  const { locale } = useLocale();
  const isSpanish = locale === "es";
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function refreshFeed(feedId: number) {
    setMessage(null);
    setError(null);

    startTransition(() => {
      void (async () => {
        try {
          const response = await fetch(`/api/calendar/feeds/${feedId}/sync`, {
            method: "POST",
          });
          const payload = (await response.json()) as { error?: string; message?: string };

          if (!response.ok) {
            setError(
              payload.error ??
                (isSpanish
                  ? "No se pudo refrescar el feed iCal."
                  : "The iCal feed could not be refreshed."),
            );
            return;
          }

          setMessage(payload.message ?? (isSpanish ? "Feed refrescado." : "Feed refreshed."));
          router.refresh();
        } catch {
          setError(
            isSpanish
              ? "No se pudo refrescar el feed iCal."
              : "The iCal feed could not be refreshed.",
          );
        }
      })();
    });
  }

  function disconnectFeed(feedId: number) {
    setMessage(null);
    setError(null);

    startTransition(() => {
      void (async () => {
        try {
          const response = await fetch(`/api/calendar/feeds/${feedId}`, {
            method: "DELETE",
          });
          const payload = (await response.json()) as { error?: string; message?: string };

          if (!response.ok) {
            setError(
              payload.error ??
                (isSpanish
                  ? "No se pudo desconectar el feed iCal."
                  : "The iCal feed could not be disconnected."),
            );
            return;
          }

          setMessage(payload.message ?? (isSpanish ? "Feed desconectado." : "Feed disconnected."));
          router.refresh();
        } catch {
          setError(
            isSpanish
              ? "No se pudo desconectar el feed iCal."
              : "The iCal feed could not be disconnected.",
          );
        }
      })();
    });
  }

  if (feeds.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      <p className="text-sm leading-6 text-[var(--workspace-muted)]">
        {isSpanish
          ? "Las conexiones guardadas de calendario se mantienen separadas de las reservas financieras. Úsalas para ocupación, check-ins, check-outs y fechas bloqueadas."
          : "Saved calendar connections stay separate from financial bookings. Use them for occupancy, check-ins, check-outs, and blocked dates."}
      </p>

      {message ? <p className="text-sm text-emerald-600">{message}</p> : null}
      {error ? <p className="text-sm text-rose-500">{error}</p> : null}

      <div className="grid gap-4 xl:grid-cols-2">
        {feeds.map((feed) => (
          <article key={feed.id} className="workspace-soft-card rounded-[24px] p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <div className="workspace-icon-chip rounded-2xl p-2.5">
                    <Link2 className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-[var(--workspace-text)]">
                      {feed.propertyName}
                    </p>
                    <p className="mt-1 text-xs text-[var(--workspace-muted)]">
                      {feed.listingName || (isSpanish ? "Listing principal" : "Primary listing")}
                    </p>
                  </div>
                </div>
              </div>

              <span
                className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${getStatusTone(feed.lastSyncStatus)}`}
              >
                {getStatusLabel(feed, locale)}
              </span>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="rounded-[18px] border border-[var(--workspace-border)] bg-white/[0.02] px-3 py-3">
                <p className="text-[11px] uppercase tracking-[0.16em] text-[var(--workspace-muted)]">
                  {isSpanish ? "Origen" : "Source"}
                </p>
                <p className="mt-2 text-sm font-semibold text-[var(--workspace-text)]">
                  {getSourceLabel(feed.source, locale)}
                </p>
              </div>
              <div className="rounded-[18px] border border-[var(--workspace-border)] bg-white/[0.02] px-3 py-3">
                <p className="text-[11px] uppercase tracking-[0.16em] text-[var(--workspace-muted)]">
                  {isSpanish ? "Eventos" : "Events"}
                </p>
                <p className="mt-2 text-sm font-semibold text-[var(--workspace-text)]">
                  {feed.eventCount}
                </p>
              </div>
              <div className="rounded-[18px] border border-[var(--workspace-border)] bg-white/[0.02] px-3 py-3">
                <p className="text-[11px] uppercase tracking-[0.16em] text-[var(--workspace-muted)]">
                  {isSpanish ? "Última sincronización" : "Last synced"}
                </p>
                <p className="mt-2 text-sm font-semibold text-[var(--workspace-text)]">
                  {formatLastSynced(feed.lastSyncedAt, locale)}
                </p>
              </div>
            </div>

            <p className="mt-4 truncate text-xs text-[var(--workspace-muted)]">
              {maskFeedUrl(feed.feedUrl)}
            </p>

            {feed.lastError ? (
              <div className="mt-4 rounded-[18px] border border-rose-300/18 bg-rose-400/10 px-3 py-3 text-sm text-rose-50">
                {feed.lastError}
              </div>
            ) : null}

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => refreshFeed(Number(feed.id))}
                disabled={isPending || !feed.id}
                className="workspace-button-secondary inline-flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60"
              >
                <RefreshCw className={`h-4 w-4 ${isPending ? "animate-spin" : ""}`} />
                {isSpanish ? "Refrescar ahora" : "Refresh now"}
              </button>
              <button
                type="button"
                onClick={() => disconnectFeed(Number(feed.id))}
                disabled={isPending || !feed.id}
                className="inline-flex items-center gap-2 rounded-2xl border border-rose-300/20 bg-rose-400/10 px-4 py-3 text-sm font-semibold text-rose-100 transition hover:bg-rose-400/16 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Trash2 className="h-4 w-4" />
                {isSpanish ? "Desconectar" : "Disconnect"}
              </button>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

export function CalendarFeedsPanel({
  feeds,
  embedded = false,
}: {
  feeds: IcalFeedRecord[];
  embedded?: boolean;
}) {
  const { locale } = useLocale();
  const isSpanish = locale === "es";
  const activeFeeds = useMemo(() => feeds.filter((feed) => feed.isActive), [feeds]);
  const latestSyncedAt = useMemo(() => {
    const timestamps = activeFeeds
      .map((feed) => {
        if (!feed.lastSyncedAt) {
          return null;
        }

        const parsed = parseISO(feed.lastSyncedAt);
        return Number.isNaN(parsed.getTime()) ? null : parsed;
      })
      .filter((value): value is Date => value instanceof Date);

    if (timestamps.length === 0) {
      return null;
    }

    return timestamps.sort((left, right) => right.getTime() - left.getTime())[0];
  }, [activeFeeds]);
  const totalEvents = activeFeeds.reduce((sum, feed) => sum + feed.eventCount, 0);

  if (feeds.length === 0) {
    return null;
  }

  return (
    <div className={embedded ? "" : "workspace-card rounded-[24px] p-5"}>
      <div className="space-y-3">
        <div>
          <p className="text-lg font-semibold text-[var(--workspace-text)]">
            {isSpanish ? "iCal conectado" : "Connected iCal"}
          </p>
          <p className="mt-1 text-sm leading-6 text-[var(--workspace-muted)]">
            {isSpanish
              ? `${activeFeeds.length} feed${activeFeeds.length === 1 ? "" : "s"} activo${activeFeeds.length === 1 ? "" : "s"} sincronizando solo en Calendar.`
              : `${activeFeeds.length} active feed${activeFeeds.length === 1 ? "" : "s"} syncing into Calendar only.`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-sm text-[var(--workspace-muted)]">
          <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5">
            {isSpanish
              ? `${totalEvents} evento${totalEvents === 1 ? "" : "s"} sincronizado${totalEvents === 1 ? "" : "s"}`
              : `${totalEvents} synced event${totalEvents === 1 ? "" : "s"}`}
          </span>
          <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5">
            {latestSyncedAt
              ? isSpanish
                ? `Última sincronización ${formatDistanceToNowStrict(latestSyncedAt, {
                    addSuffix: true,
                    locale: getDateFnsLocale(locale),
                  })}`
                : `Latest sync ${formatDistanceToNowStrict(latestSyncedAt, {
                    addSuffix: true,
                    locale: getDateFnsLocale(locale),
                  })}`
              : isSpanish
                ? "Esperando la primera sincronización"
                : "Waiting for first sync"}
          </span>
        </div>

        <div className="flex flex-wrap gap-2">
          {activeFeeds.map((feed) => (
            <span
              key={feed.id}
              className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs font-medium text-[var(--workspace-text)]"
            >
              {feed.propertyName} · {getSourceLabel(feed.source, locale)}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
