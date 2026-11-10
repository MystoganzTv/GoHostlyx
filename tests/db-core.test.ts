import { afterEach, describe, expect, it } from "vitest";
import { buildPoolConfig } from "@/lib/db-core";

const savedEnv = { ...process.env };

afterEach(() => {
  process.env = { ...savedEnv };
});

describe("buildPoolConfig", () => {
  it("strips sslmode and Supabase-only params so our TLS settings win", () => {
    const config = buildPoolConfig(
      "postgres://postgres.ref:secret@aws-1-us-west-2.pooler.supabase.com:6543/postgres?sslmode=require&supa=base-pooler.x",
    );

    expect(config.connectionString).not.toContain("sslmode");
    expect(config.connectionString).not.toContain("supa=");
    expect(config.connectionString).toContain(":6543/postgres");
  });

  it("verifies certificates by default for remote hosts", () => {
    delete process.env.DATABASE_SSL_INSECURE;
    delete process.env.DATABASE_CA_CERT;
    expect(buildPoolConfig("postgres://u:p@db.example.com:5432/app").ssl).toEqual({ rejectUnauthorized: true });
  });

  it("honours DATABASE_SSL_INSECURE for providers with private CAs", () => {
    process.env.DATABASE_SSL_INSECURE = "true";
    delete process.env.DATABASE_CA_CERT;
    expect(buildPoolConfig("postgres://u:p@db.example.com:5432/app").ssl).toEqual({ rejectUnauthorized: false });
  });

  it("prefers a provided CA and accepts escaped newlines", () => {
    process.env.DATABASE_CA_CERT = "-----BEGIN CERTIFICATE-----\\nABC\\n-----END CERTIFICATE-----";
    process.env.DATABASE_SSL_INSECURE = "true";
    expect(buildPoolConfig("postgres://u:p@db.example.com:5432/app").ssl).toEqual({
      ca: "-----BEGIN CERTIFICATE-----\nABC\n-----END CERTIFICATE-----",
      rejectUnauthorized: true,
    });
  });

  it("uses no TLS for a database on this machine", () => {
    expect(buildPoolConfig("postgres://postgres@127.0.0.1:5432/app").ssl).toBe(false);
  });
});
