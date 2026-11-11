// Runs against a real Postgres when TEST_DATABASE_URL is set (a throwaway
// database with the migrations applied); skipped otherwise.
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const owner = `prices-${Date.now()}@example.com`;

describe.skipIf(!testDatabaseUrl)("nightly prices", () => {
  let db: typeof import("@/lib/db");
  let trash: typeof import("@/lib/trash");
  let pool: import("pg").Pool;
  let propertyId = 0;

  beforeAll(async () => {
    process.env.DATABASE_URL = testDatabaseUrl;
    db = await import("@/lib/db");
    trash = await import("@/lib/trash");
    pool = (await import("@/lib/db-core")).getPostgresPool();
    propertyId = await db.createPropertyDefinition({ ownerEmail: owner, name: "HomeXperience", countryCode: "ES" });
  });

  afterAll(async () => {
    for (const table of ["nightly_prices", "deleted_items", "properties"]) {
      await pool.query(`DELETE FROM ${table} WHERE owner_email = $1`, [owner]);
    }
  });

  it("saves prices linked to the property and overwrites a night saved again", async () => {
    await db.saveNightlyPrices({
      ownerEmail: owner,
      propertyName: "HomeXperience",
      channel: "Airbnb",
      prices: [
        { date: "2025-12-05", price: 80 },
        { date: "2026-12-05", price: 77 },
      ],
    });
    await db.saveNightlyPrices({
      ownerEmail: owner,
      propertyName: "homexperience",
      channel: "Airbnb",
      prices: [{ date: "2026-12-05", price: 79 }],
    });

    expect(await db.getNightlyPrices(owner)).toEqual([
      { propertyName: "HomeXperience", channel: "Airbnb", date: "2025-12-05", price: 80 },
      { propertyName: "HomeXperience", channel: "Airbnb", date: "2026-12-05", price: 79 },
    ]);
    const linked = await pool.query("SELECT DISTINCT property_id FROM nightly_prices WHERE owner_email = $1", [owner]);
    expect(linked.rows.map((row) => Number(row.property_id))).toEqual([propertyId]);
  });

  it("follows a property rename", async () => {
    await db.updatePropertyDefinition({ ownerEmail: owner, propertyId, name: "Home Xperience", countryCode: "ES" });

    const prices = await db.getNightlyPrices(owner);
    expect(new Set(prices.map((item) => item.propertyName))).toEqual(new Set(["Home Xperience"]));
  });

  it("asks before deleting a property that only has prices, then deletes and restores them", async () => {
    await expect(db.deletePropertyDefinition({ ownerEmail: owner, propertyId })).rejects.toThrow(/Confirm destructive delete/);

    await db.deletePropertyDefinition({ ownerEmail: owner, propertyId, deleteLinkedData: true });
    expect(await db.getNightlyPrices(owner)).toEqual([]);

    const [item] = await trash.listDeletedItems(owner);
    await trash.restoreDeletedItem(owner, item.id);
    expect((await db.getNightlyPrices(owner)).map((row) => row.price)).toEqual([80, 79]);
  });
});
