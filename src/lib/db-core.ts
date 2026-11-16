// Database connection layer. GoHostlyx stores everything in Postgres (Supabase)
// in every environment; the schema lives in supabase/migrations and is applied by
// the Supabase GitHub integration, not at runtime.

import { Pool, type PoolConfig } from "pg";
import type { UserSettings } from "./types";
import { getCurrencyForCountry } from "./markets";
import { getDefaultTaxRateByCountry } from "./tax";

let postgresPool: Pool | null = null;

// DATABASE_URL is set by hand for production and local development.
// POSTGRES_URL is what the Supabase <-> Vercel integration injects, including
// the per-branch databases used by preview deployments.
function getDatabaseConnectionString() {
  return process.env.DATABASE_URL || process.env.POSTGRES_URL || "";
}

export function isPostgresConfigured() {
  return Boolean(getDatabaseConnectionString());
}

export function normalizeOwnerEmail(ownerEmail: string) {
  return ownerEmail.trim().toLowerCase();
}

export function getDefaultUserSettings(fallbackBusinessName: string): UserSettings {
  const primaryCountryCode = "US";
  return {
    businessName: fallbackBusinessName.trim() || "My rental business",
    primaryCountryCode,
    currencyCode: getCurrencyForCountry(primaryCountryCode),
    taxCountryCode: primaryCountryCode,
    taxRate: getDefaultTaxRateByCountry(primaryCountryCode),
  };
}

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

/**
 * Parse the connection URL ourselves so TLS is decided here, not by query
 * parameters. node-postgres lets `sslmode` in the URL override the `ssl`
 * option, and the Supabase integration adds `sslmode=require`, which would
 * reject Supabase's own certificate chain.
 */
export function buildPoolConfig(connectionString: string): PoolConfig {
  const url = new URL(connectionString);
  for (const param of ["sslmode", "sslrootcert", "sslcert", "sslkey", "supa", "pgbouncer"]) {
    url.searchParams.delete(param);
  }

  return {
    connectionString: url.toString(),
    ssl: getSslConfig(url.hostname),
    // Serverless functions each hold their own pool; keep it small so the
    // Supabase pooler is not exhausted by many concurrent instances.
    max: 5,
    idleTimeoutMillis: 10_000,
  };
}

function getSslConfig(hostname: string): PoolConfig["ssl"] {
  // A Postgres on this machine (tests, CI) has no TLS.
  if (LOCAL_HOSTS.has(hostname)) {
    return false;
  }

  // Preferred: validate the server certificate against the provider's CA.
  // Accept the PEM with real line breaks or with literal "\n" escapes, which is
  // how it often ends up after pasting into a dashboard field.
  const ca = process.env.DATABASE_CA_CERT?.replace(/\\n/g, "\n").trim();
  if (ca) {
    return { ca, rejectUnauthorized: true };
  }

  // Escape hatch for providers whose CA is not in Node's trust store (the
  // Supabase pooler). Encrypted, but the certificate is not verified.
  if (process.env.DATABASE_SSL_INSECURE === "true") {
    return { rejectUnauthorized: false };
  }

  return { rejectUnauthorized: true };
}

export function getPostgresPool() {
  if (!postgresPool) {
    const connectionString = getDatabaseConnectionString();

    if (!connectionString) {
      throw new Error(
        "DATABASE_URL is not configured. Point it at a Supabase database (see README → Local development).",
      );
    }

    postgresPool = new Pool(buildPoolConfig(connectionString));
  }

  return postgresPool;
}

/** Kept so callers can fail fast with a clear error when no database is configured. */
export async function ensureDatabase() {
  getPostgresPool();
}
