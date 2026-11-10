// Runs against a real Postgres when TEST_DATABASE_URL is set (a throwaway
// database with the migrations applied); skipped otherwise.
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const owner = `trash-${Date.now()}@example.com`;

describe.skipIf(!testDatabaseUrl)("recently deleted", () => {
  let db: typeof import("@/lib/db");
  let trash: typeof import("@/lib/trash");
  let pool: import("pg").Pool;
  let propertyId = 0;
  let importId = 0;

  const count = async (table: string) =>
    Number((await pool.query(`SELECT COUNT(*) AS n FROM ${table} WHERE owner_email = $1`, [owner])).rows[0].n);

  beforeAll(async () => {
    process.env.DATABASE_URL = testDatabaseUrl;
    db = await import("@/lib/db");
    trash = await import("@/lib/trash");
    pool = (await import("@/lib/db-core")).getPostgresPool();

    propertyId = await db.createPropertyDefinition({ ownerEmail: owner, name: "Ocean Villa", countryCode: "US" });
    const imported = await pool.query(
      `INSERT INTO imports (owner_email, file_name, property_name, source, imported_at, bookings_count, expenses_count)
       VALUES ($1, 'airbnb.xlsx', 'Ocean Villa', 'upload', NOW(), 1, 1) RETURNING id`,
      [owner],
    );
    importId = Number(imported.rows[0].id);
    await pool.query(
      `INSERT INTO bookings (owner_email, import_id, property_name, check_in, checkout, guest_name, guest_count, channel,
         rental_period, price_per_night, extra_fee, discount, rental_revenue, cleaning_fee, total_revenue, host_fee, payout, nights)
       VALUES ($1, $2, 'Ocean Villa', '2026-03-02', '2026-03-05', 'Ana Gomez', 2, 'Airbnb', '3 nights', 150, 0, 0, 450, 60, 510, 45, 465, 3)`,
      [owner, importId],
    );
    await pool.query(
      `INSERT INTO expenses (owner_email, import_id, property_name, date, category, amount, description, note)
       VALUES ($1, $2, 'Ocean Villa', '2026-03-06', 'Cleaning', 80, 'Turnover clean', '')`,
      [owner, importId],
    );
  });

  afterAll(async () => {
    for (const table of ["deleted_items", "bookings", "expenses", "imports", "property_units", "properties"]) {
      await pool.query(`DELETE FROM ${table} WHERE owner_email = $1`, [owner]);
    }
  });

  it("restores a deleted import with its bookings and expenses", async () => {
    await db.deleteImportBatch({ ownerEmail: owner, importId });
    expect(await count("bookings")).toBe(0);

    const [item] = await trash.listDeletedItems(owner);
    expect(item).toMatchObject({ kind: "import", label: "airbnb.xlsx", rowCount: 3 });

    await trash.restoreDeletedItem(owner, item.id);
    expect(await count("imports")).toBe(1);
    expect(await count("bookings")).toBe(1);
    expect(await count("expenses")).toBe(1);
    expect(await trash.listDeletedItems(owner)).toEqual([]);
  });

  it("restores a deleted property with everything linked to it", async () => {
    await db.deletePropertyDefinition({ ownerEmail: owner, propertyId, deleteLinkedData: true });
    expect(await count("properties")).toBe(0);

    const [item] = await trash.listDeletedItems(owner);
    expect(item).toMatchObject({ kind: "property", label: "Ocean Villa" });

    await trash.restoreDeletedItem(owner, item.id);
    const properties = await db.getPropertyDefinitions(owner);
    expect(properties.map((property) => [property.id, property.name])).toEqual([[propertyId, "Ocean Villa"]]);
    expect(await count("bookings")).toBe(1);
    expect(await count("imports")).toBe(1);
  });

  it("restores a single deleted booking", async () => {
    const booking = await pool.query("SELECT id FROM bookings WHERE owner_email = $1", [owner]);
    await db.deleteBookingRecord({ ownerEmail: owner, bookingId: Number(booking.rows[0].id) });
    const [item] = await trash.listDeletedItems(owner);
    expect(item).toMatchObject({ kind: "booking", label: "Ana Gomez · 2026-03-02" });

    await trash.restoreDeletedItem(owner, item.id);
    expect(await count("bookings")).toBe(1);
  });

  it("refuses to restore a property over one with the same name", async () => {
    await db.deletePropertyDefinition({ ownerEmail: owner, propertyId, deleteLinkedData: true });
    await db.createPropertyDefinition({ ownerEmail: owner, name: "Ocean Villa", countryCode: "US" });
    const [item] = await trash.listDeletedItems(owner);

    await expect(trash.restoreDeletedItem(owner, item.id)).rejects.toThrow(/already exists/);
  });
});
