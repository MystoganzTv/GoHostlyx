import type { PoolClient } from "pg";
import { ensureDatabase, getPostgresPool } from "@/lib/db-core";

export type DeletedItemKind = "property" | "import" | "booking" | "expense";

export type DeletedItem = {
  id: number;
  kind: DeletedItemKind;
  label: string;
  deletedAt: string;
  expiresAt: string;
  rowCount: number;
};

type TrashPayload = Array<{ table: TrashTable; rows: Array<Record<string, unknown>> }>;

/** Tables that can be copied to the trash, in the order they must be restored (parents first). */
const restoreOrder = [
  "properties",
  "property_units",
  "imports",
  "bookings",
  "expenses",
  "calendar_closures",
  "calendar_events",
  "ical_feeds",
  "financial_documents",
] as const;

export type TrashTable = (typeof restoreOrder)[number];

/**
 * Copies the rows about to be deleted into deleted_items. Call it inside the
 * delete's transaction, before the DELETE statements, with one selection per
 * table (a WHERE clause on that table and its parameters).
 */
export async function copyToTrash(
  client: PoolClient,
  {
    ownerEmail,
    kind,
    label,
    selections,
  }: {
    ownerEmail: string;
    kind: DeletedItemKind;
    label: string;
    selections: Array<{ table: TrashTable; where: string; params: unknown[] }>;
  },
) {
  const payload: TrashPayload = [];

  for (const table of restoreOrder) {
    for (const selection of selections.filter((item) => item.table === table)) {
      const result = await client.query(
        `SELECT to_jsonb(t) AS row FROM ${table} AS t WHERE ${selection.where}`,
        selection.params,
      );
      if (result.rows.length > 0) {
        payload.push({ table, rows: result.rows.map((row) => row.row as Record<string, unknown>) });
      }
    }
  }

  if (payload.length === 0) {
    return;
  }

  await client.query("DELETE FROM deleted_items WHERE owner_email = $1 AND expires_at <= NOW()", [ownerEmail]);
  await client.query(
    "INSERT INTO deleted_items (owner_email, kind, label, payload) VALUES ($1, $2, $3, $4::jsonb)",
    [ownerEmail, kind, label, JSON.stringify(payload)],
  );
}

export async function listDeletedItems(ownerEmail: string): Promise<DeletedItem[]> {
  await ensureDatabase();
  const result = await getPostgresPool().query(
    `
      SELECT
        id,
        kind,
        label,
        deleted_at AS "deletedAt",
        expires_at AS "expiresAt",
        (SELECT COALESCE(SUM(jsonb_array_length(part -> 'rows')), 0) FROM jsonb_array_elements(payload) AS part) AS "rowCount"
      FROM deleted_items
      WHERE owner_email = $1 AND expires_at > NOW()
      ORDER BY deleted_at DESC
      LIMIT 50
    `,
    [ownerEmail],
  );

  return result.rows.map((row) => ({
    id: Number(row.id),
    kind: row.kind as DeletedItemKind,
    label: String(row.label),
    deletedAt: new Date(row.deletedAt).toISOString(),
    expiresAt: new Date(row.expiresAt).toISOString(),
    rowCount: Number(row.rowCount),
  }));
}

/** Puts every copied row back and removes the item from the trash. */
export async function restoreDeletedItem(ownerEmail: string, itemId: number) {
  await ensureDatabase();
  const client = await getPostgresPool().connect();

  try {
    await client.query("BEGIN");
    const itemResult = await client.query(
      "SELECT payload, label FROM deleted_items WHERE id = $1 AND owner_email = $2 AND expires_at > NOW() FOR UPDATE",
      [itemId, ownerEmail],
    );
    const item = itemResult.rows[0] as { payload: TrashPayload; label: string } | undefined;

    if (!item) {
      throw new Error("That item is no longer in Recently deleted.");
    }

    for (const table of restoreOrder) {
      for (const part of item.payload.filter((entry) => entry.table === table)) {
        // Only rows that belong to this owner, and only columns the table still has.
        const rows = part.rows.filter((row) => row.owner_email === ownerEmail);
        if (rows.length === 0) {
          continue;
        }

        const columnsResult = await client.query(
          "SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1",
          [table],
        );
        const existingColumns = new Set(columnsResult.rows.map((row) => String(row.column_name)));
        const columns = Object.keys(rows[0]).filter((column) => existingColumns.has(column));
        const columnList = columns.map((column) => `"${column}"`).join(", ");

        if (table === "properties") {
          const names = rows.map((row) => String(row.name ?? ""));
          const clash = await client.query(
            "SELECT name FROM properties WHERE owner_email = $1 AND LOWER(name) = ANY($2::text[]) AND NOT (id = ANY($3::bigint[]))",
            [ownerEmail, names.map((name) => name.toLowerCase()), rows.map((row) => Number(row.id))],
          );
          if (clash.rows[0]) {
            throw new Error(
              `A property called "${String(clash.rows[0].name)}" already exists. Rename it, then restore again.`,
            );
          }
        }

        await client.query(
          `
            INSERT INTO ${table} (${columnList})
            SELECT ${columnList} FROM jsonb_populate_recordset(NULL::${table}, $1::jsonb)
            ON CONFLICT DO NOTHING
          `,
          [JSON.stringify(rows)],
        );
      }
    }

    await client.query("DELETE FROM deleted_items WHERE id = $1", [itemId]);
    await client.query("COMMIT");

    return { label: item.label };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
