-- Recently deleted: a copy of whatever a user deletes (a property with its
-- data, an import, a booking, an expense), kept for 7 days so it can be
-- restored. The app writes the copy in the same transaction as the delete.

CREATE TABLE IF NOT EXISTS public.deleted_items (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  owner_email TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('property', 'import', 'booking', 'expense')),
  label TEXT NOT NULL,
  -- [{ "table": "bookings", "rows": [ ...to_jsonb(row)... ] }, ...] in restore order.
  payload JSONB NOT NULL,
  deleted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '7 days'
);

CREATE INDEX IF NOT EXISTS idx_deleted_items_owner_deleted_at
  ON public.deleted_items (owner_email, deleted_at DESC);

ALTER TABLE public.deleted_items ENABLE ROW LEVEL SECURITY;
