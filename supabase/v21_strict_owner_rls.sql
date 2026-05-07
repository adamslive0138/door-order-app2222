-- v21: Strict owner-based RLS for orders and cariler
-- Run in Supabase SQL Editor.
--
-- Problem: v18 policy allowed satis users to see records where owner_id IS NULL.
-- Fix: remove the NULL exception — only admin sees null-owner records.
--
-- checks: already handled correctly in v20 (no changes needed here).
--
-- Rule:
--   admin  → all records in own company (owner_id IS NULL included)
--   satis  → only records where owner_id = auth.uid() (legacy nulls hidden)

-- ── helpers ───────────────────────────────────────────────────────────────────
-- Inline subqueries kept consistent with existing migrations.

-- ── 1. orders ─────────────────────────────────────────────────────────────────

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "company_isolation"  ON orders;
DROP POLICY IF EXISTS "owner_role_access"  ON orders;

CREATE POLICY "owner_role_access" ON orders
  FOR ALL
  USING (
    company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
    AND (
      owner_id = auth.uid()
      OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
    )
  )
  WITH CHECK (
    company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
    AND (
      owner_id = auth.uid()
      OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
    )
  );

-- ── 2. cariler ────────────────────────────────────────────────────────────────

ALTER TABLE cariler ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "company_isolation"  ON cariler;
DROP POLICY IF EXISTS "owner_role_access"  ON cariler;

CREATE POLICY "owner_role_access" ON cariler
  FOR ALL
  USING (
    company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
    AND (
      owner_id = auth.uid()
      OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
    )
  )
  WITH CHECK (
    company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
    AND (
      owner_id = auth.uid()
      OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
    )
  );

-- ── 3. profiles — admin reads company-wide ────────────────────────────────────
-- Without this, admin cannot resolve owner names or see the staff list.
-- select_own from v17 stays; we ADD a second policy for admin company reads.

DROP POLICY IF EXISTS "admin_read_company" ON profiles;

CREATE POLICY "admin_read_company" ON profiles
  FOR SELECT
  USING (
    company_id IN (SELECT company_id FROM profiles p2 WHERE p2.id = auth.uid())
    AND (SELECT role FROM profiles p3 WHERE p3.id = auth.uid()) = 'admin'
  );

-- ── Reset schema cache ────────────────────────────────────────────────────────

NOTIFY pgrst, 'reload schema';
