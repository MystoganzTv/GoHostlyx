import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
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
const ICAL_FETCH_TIMEOUT_MS = 10_000;
const ICAL_MAX_BYTES = 5 * 1024 * 1024; // 5 MB is far beyond any real listing calendar

function isValidFeedProtocol(url: URL) {
  return url.protocol === "http:" || url.protocol === "https:";
}

// Block requests aimed at private, loopback, link-local or cloud-metadata
// addresses to prevent server-side request forgery (SSRF) through feed URLs.
function isBlockedIpAddress(address: string) {
  const value = address.trim().toLowerCase();

  if (
    value === "::1" ||
    value === "::" ||
    value.startsWith("fc") ||
    value.startsWith("fd") ||
    value.startsWith("fe80") ||
    value.startsWith("::ffff:")
  ) {
    return true;
  }

  const parts = value.split(".").map((part) => Number(part));
  if (parts.length === 4 && parts.every((part) => Number.isInteger(part) && part >= 0 && part <= 255)) {
    const [a, b] = parts;
    if (a === 0 || a === 10 || a === 127) return true; // this-host, private, loopback
    if (a === 100 && b >= 64 && b <= 127) return true; // carrier-grade NAT (100.64.0.0/10)
    if (a === 169 && b === 254) return true; // link-local + cloud metadata (169.254.169.254)
    if (a === 198 && (b === 18 || b === 19)) return true; // benchmarking (198.18.0.0/15)
    if (a === 172 && b >= 16 && b <= 31) return true; // private
    if (a === 192 && b === 168) return true; // private
    if (a >= 224) return true; // multicast / reserved
  }

  return false;
}

async function assertSafeFeedHost(url: URL) {
  const host = url.hostname.replace(/^\[|\]$/g, "");

  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".internal")) {
    throw new Error("That iCal URL points to a non-public address.");
  }

  if (isIP(host)) {
    if (isBlockedIpAddress(host)) {
      throw new Error("That iCal URL points to a non-public address.");
    }
    return;
  }

  // Resolve the hostname and reject if it maps to a private/loopback target.
  const resolved = await lookup(host, { all: true }).catch(() => []);
  if (resolved.length === 0) {
    throw new Error("GoHostlyx could not resolve that iCal host.");
  }

  if (resolved.some((entry) => isBlockedIpAddress(entry.address))) {
    throw new Error("That iCal URL points to a non-public address.");
  }
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
  await assertSafeFeedHost(new URL(feedUrl));

  let response: Response;

  try {
    response = await fetch(feedUrl, {
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(ICAL_FETCH_TIMEOUT_MS),
      headers: {
        Accept: "text/calendar,text/plain;q=0.9,*/*;q=0.8",
      },
    });
  } catch (error) {
    if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) {
      throw new Error("That iCal feed took too long to respond. Try again in a moment.");
    }

    throw new Error("GoHostlyx could not fetch that iCal feed right now.");
  }

  if (!response.ok) {
    throw new Error("GoHostlyx could not fetch that iCal feed right now.");
  }

  const declaredLength = Number(response.headers.get("content-length") ?? 0);
  if (declaredLength > ICAL_MAX_BYTES) {
    throw new Error("That iCal feed is too large to import.");
  }

  // Read the body incrementally so an endless or huge response cannot exhaust
  // memory on the serverless function.
  const reader = response.body?.getReader();
  if (!reader) {
    return "";
  }

  const chunks: Uint8Array[] = [];
  let received = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    received += value.byteLength;
    if (received > ICAL_MAX_BYTES) {
      await reader.cancel();
      throw new Error("That iCal feed is too large to import.");
    }

    chunks.push(value);
  }

  return new TextDecoder().decode(Buffer.concat(chunks));
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
