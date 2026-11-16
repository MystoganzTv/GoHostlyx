// Runs against a real Postgres when TEST_DATABASE_URL is set (a throwaway
// database with the migrations applied); skipped otherwise.
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const owner = `rename-${Date.now()}@example.com`;

describe.skipIf(!testDatabaseUrl)("renaming and deleting a property", () => {
  let db: typeof import("@/lib/db");
  let pool: import("pg").Pool;

  beforeAll(async () => {
    process.env.DATABASE_URL = testDatabaseUrl;
    db = await import("@/lib/db");
    pool = (await import("@/lib/db-core")).getPostgresPool();

    const now = new Date().toISOString();
    await pool.query(
      "INSERT INTO properties (owner_email, name, country_code, created_at) VALUES ($1, 'Main Property', 'US', $2)",
      [owner, now],
    );
    await pool.query(
      `INSERT INTO imports (owner_email, file_name, property_name, source, imported_at, bookings_count, expenses_count)
       VALUES ($1, 'airbnb.xlsx', 'Main Property', 'upload', $2, 3, 0)`,
      [owner, now],
    );
    await pool.query(
      `INSERT INTO calendar_closures (owner_email, property_name, date, reason, note, source)
       VALUES ($1, 'Main Property', '2026-11-20', 'Owner stay', '', 'manual')`,
      [owner],
    );
  });

  afterAll(async () => {
    for (const table of ["imports", "calendar_closures", "properties"]) {
      await pool.query(`DELETE FROM ${table} WHERE owner_email = $1`, [owner]);
    }
  });

  it("renames in place without bringing the old name back as a second property", async () => {
    const [property] = await db.getPropertyDefinitions(owner);

    await db.updatePropertyDefinition({
      ownerEmail: owner,
      propertyId: property.id ?? 0,
      name: "Ocean Villa",
      countryCode: "US",
    });

    const properties = await db.getPropertyDefinitions(owner);
    expect(properties.map((item) => item.name)).toEqual(["Ocean Villa"]);

    const imports = await pool.query("SELECT property_name FROM imports WHERE owner_email = $1", [owner]);
    expect(imports.rows.map((row) => row.property_name)).toEqual(["Ocean Villa"]);

    const closures = await pool.query(
      "SELECT property_name FROM calendar_closures WHERE owner_email = $1",
      [owner],
    );
    expect(closures.rows.map((row) => row.property_name)).toEqual(["Ocean Villa"]);
  });

  it("deletes the property and its linked data together", async () => {
    const [property] = await db.getPropertyDefinitions(owner);

    const result = await db.deletePropertyDefinition({
      ownerEmail: owner,
      propertyId: property.id ?? 0,
      deleteLinkedData: true,
    });

    expect(result.deletedImportsCount).toBe(1);
    expect(await db.getPropertyDefinitions(owner)).toEqual([]);
  });
});
