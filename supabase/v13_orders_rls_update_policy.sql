-- ============================================================
-- Migration v13: Full company_isolation RLS policy for orders
--
-- Root cause of "update error {}":
--   The previous version created a FOR UPDATE-only policy.
--   PostgREST internally does a SELECT before executing the UPDATE
--   to validate the row. With no SELECT policy, that internal SELECT
--   returns 0 rows → PostgREST returns an error object with
--   non-enumerable properties (logs as {}).
--
-- Fix:
--   Drop the FOR UPDATE-only policy (if it was already applied).
--   Add a single company_isolation policy with no FOR clause,
--   which covers ALL operations (SELECT, INSERT, UPDATE, DELETE).
--   This matches the exact pattern used by cari_hareketler, documents,
--   offers, and checks tables.
-- ============================================================

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- Drop both names in case the FOR UPDATE-only version was already applied
DROP POLICY IF EXISTS "orders_update_company_isolation" ON orders;
DROP POLICY IF EXISTS "company_isolation"               ON orders;

-- Single policy covering all operations (no FOR clause = FOR ALL)
CREATE POLICY "company_isolation" ON orders
  USING (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  );

NOTIFY pgrst, 'reload schema';
