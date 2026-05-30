import {
  getIcalFeedById,
  getIcalFeeds,
  replaceCalendarEventsForFeed,
  updateIcalFeedSyncState,
  upsertIcalFeed,
} from "@/lib/db";
import { parseIcalEvents } from "@/lib/ical";
import type { CalendarEventSource, IcalFeedRecord } from "@/lib/types";

const DEFAULT_AUTO_SYNC_AGE_MS = 1000 * 60 * 30;

function isValidFeedProtocol(url: URL) {
  return url.protocol === "http:" || url.protocol === "https:";
}

export function validateIcalFeedUrl(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    throw new Error("Paste the public iCal URL first.");
  }

  let parsedUrl: URL;

  try {
    parsedUrl = new URL(trimmed);
  } catch {
    throw new Error("The iCal URL is not valid.");
  }

  if (!isValidFeedProtocol(parsedUrl)) {
    throw new Error("Use an http or https iCal URL.");
  }

  return parsedUrl.toString();
}

async function fetchIcalText(feedUrl: string) {
  const response = await fetch(feedUrl, {
    cache: "no-store",
    headers: {
      Accept: "text/calendar,text/plain;q=0.9,*/*;q=0.8",
    },
  });

  if (!response.ok) {
    throw new Error("Hostlyx could not fetch that iCal feed right now.");
  }

  return response.text();
}

export async function syncIcalFeedRecord({
  ownerEmail,
  feed,
}: {
  ownerEmail: string;
  feed: IcalFeedRecord;
}) {
  if (!feed.id) {
    throw new Error("The iCal feed is missing its id.");
  }

  await updateIcalFeedSyncState({
    ownerEmail,
    feedId: feed.id,
    status: "pending",
    error: null,
  });

  try {
    const calendarText = await fetchIcalText(feed.feedUrl);
    const events = parseIcalEvents(calendarText, feed.source);
    const syncedAt = new Date().toISOString();

    await replaceCalendarEventsForFeed({
      ownerEmail,
      feed,
      events,
      syncedAt,
    });

    await updateIcalFeedSyncState({
      ownerEmail,
      feedId: feed.id,
      status: "success",
      syncedAt,
      error: null,
    });

    return {
      feedId: feed.id,
      syncedAt,
      eventCount: events.length,
    };
  } catch (error) {
    await updateIcalFeedSyncState({
      ownerEmail,
      feedId: feed.id,
      status: "error",
      error: error instanceof Error ? error.message : "The iCal feed could not be synced.",
    });
    throw error;
  }
}

export async function syncIcalFeedById({
  ownerEmail,
  feedId,
}: {
  ownerEmail: string;
  feedId: number;
}) {
  const feed = await getIcalFeedById({ ownerEmail, feedId });

  if (!feed || !feed.isActive) {
    throw new Error("This iCal feed is no longer active.");
  }

  return syncIcalFeedRecord({
    ownerEmail,
    feed,
  });
}

export async function saveAndSyncIcalFeed({
  ownerEmail,
  propertyId,
  propertyName,
  listingId,
  listingName,
  source,
  feedUrl,
}: {
  ownerEmail: string;
  propertyId: number;
  propertyName: string;
  listingId?: number | null;
  listingName: string;
  source: CalendarEventSource;
  feedUrl: string;
}) {
  const normalizedFeedUrl = validateIcalFeedUrl(feedUrl);
  const feedId = await upsertIcalFeed({
    ownerEmail,
    propertyId,
    propertyName,
    listingId,
    listingName,
    source,
    feedUrl: normalizedFeedUrl,
  });

  return syncIcalFeedById({
    ownerEmail,
    feedId,
  });
}

function shouldSyncFeed(feed: IcalFeedRecord, maxAgeMs: number) {
  if (!feed.isActive) {
    return false;
  }

  if (!feed.lastSyncedAt) {
    return true;
  }

  const lastSyncedAt = new Date(feed.lastSyncedAt);

  if (Number.isNaN(lastSyncedAt.getTime())) {
    return true;
  }

  return Date.now() - lastSyncedAt.getTime() >= maxAgeMs;
}

export async function syncDueIcalFeeds(
  ownerEmail: string,
  options?: {
    maxAgeMs?: number;
  },
) {
  const maxAgeMs = options?.maxAgeMs ?? DEFAULT_AUTO_SYNC_AGE_MS;
  const feeds = await getIcalFeeds(ownerEmail);
  let attempted = 0;
  let synced = 0;
  let failed = 0;

  for (const feed of feeds) {
    if (!shouldSyncFeed(feed, maxAgeMs)) {
      continue;
    }

    attempted += 1;

    try {
      await syncIcalFeedRecord({
        ownerEmail,
        feed,
      });
      synced += 1;
    } catch {
      // Keep opportunistic auto-sync best-effort so page loads still continue.
      failed += 1;
    }
  }

  return {
    attempted,
    synced,
    failed,
  };
}
