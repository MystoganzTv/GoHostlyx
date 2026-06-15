// Lightweight rate limiting with an Upstash Redis backend (the right choice on
// Vercel serverless, where state must survive across invocations/instances) and
// an in-memory fallback when Upstash env vars are absent (e.g. local dev).
//
// Configure in production:
//   UPSTASH_REDIS_REST_URL
//   UPSTASH_REDIS_REST_TOKEN
//
// Uses only `fetch`, so no extra dependency is required.

type RateLimitResult = {
  success: boolean;
  remaining: number;
  /** Seconds until the window resets (best-effort). */
  resetSeconds: number;
};

const upstashUrl = process.env.UPSTASH_REDIS_REST_URL ?? "";
const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN ?? "";
const hasUpstash = Boolean(upstashUrl && upstashToken);

// ---- In-memory fallback (per-instance) -------------------------------------

type MemoryEntry = { count: number; expiresAt: number };
const memoryBuckets = new Map<string, MemoryEntry>();

function memoryRateLimit(key: string, limit: number, windowSec: number): RateLimitResult {
  const now = Date.now();
  const existing = memoryBuckets.get(key);

  if (!existing || existing.expiresAt <= now) {
    memoryBuckets.set(key, { count: 1, expiresAt: now + windowSec * 1000 });
    return { success: true, remaining: limit - 1, resetSeconds: windowSec };
  }

  existing.count += 1;
  const resetSeconds = Math.max(1, Math.ceil((existing.expiresAt - now) / 1000));

  if (existing.count > limit) {
    return { success: false, remaining: 0, resetSeconds };
  }

  return { success: true, remaining: Math.max(0, limit - existing.count), resetSeconds };
}

// Opportunistically drop expired buckets so the map cannot grow unbounded.
function sweepMemory() {
  if (memoryBuckets.size < 5000) {
    return;
  }
  const now = Date.now();
  for (const [key, entry] of memoryBuckets) {
    if (entry.expiresAt <= now) {
      memoryBuckets.delete(key);
    }
  }
}

// ---- Upstash REST backend --------------------------------------------------

async function upstashRateLimit(
  key: string,
  limit: number,
  windowSec: number,
): Promise<RateLimitResult> {
  // Fixed-window counter: INCR then set TTL only if not already set (NX).
  const response = await fetch(`${upstashUrl}/pipeline`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${upstashToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify([
      ["INCR", key],
      ["EXPIRE", key, String(windowSec), "NX"],
      ["TTL", key],
    ]),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Upstash rate-limit request failed: ${response.status}`);
  }

  const results = (await response.json()) as Array<{ result?: number; error?: string }>;
  const count = Number(results?.[0]?.result ?? 0);
  const ttl = Number(results?.[2]?.result ?? windowSec);
  const resetSeconds = ttl > 0 ? ttl : windowSec;

  if (count > limit) {
    return { success: false, remaining: 0, resetSeconds };
  }

  return { success: true, remaining: Math.max(0, limit - count), resetSeconds };
}

// ---- Public API ------------------------------------------------------------

/**
 * Increment the counter for `key` and report whether the caller is within
 * `limit` requests per `windowSec`. Fails open (allows the request) if the
 * Upstash backend errors, so rate limiting never takes the app down.
 */
export async function rateLimit({
  key,
  limit,
  windowSec,
}: {
  key: string;
  limit: number;
  windowSec: number;
}): Promise<RateLimitResult> {
  if (!hasUpstash) {
    sweepMemory();
    return memoryRateLimit(key, limit, windowSec);
  }

  try {
    return await upstashRateLimit(key, limit, windowSec);
  } catch {
    // Fail open: never block legitimate traffic because the limiter is down.
    return { success: true, remaining: limit, resetSeconds: windowSec };
  }
}

/** Best-effort client IP from proxy headers (Vercel sets x-forwarded-for). */
export function getClientIp(headers: Headers | Record<string, string | string[] | undefined>): string {
  const read = (name: string): string | undefined => {
    if (headers instanceof Headers) {
      return headers.get(name) ?? undefined;
    }
    const value = headers[name] ?? headers[name.toLowerCase()];
    return Array.isArray(value) ? value[0] : value;
  };

  const forwarded = read("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() || "unknown";
  }

  return read("x-real-ip")?.trim() || "unknown";
}
