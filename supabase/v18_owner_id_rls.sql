-- v18: owner_id based role access for orders and cariler
-- Run in Supabase SQL Editor.
--
-- Adds owner_id to orders and cariler.
-- RLS: admin sees all in company, satis sees only own records.
-- Legacy records (owner_id IS NULL) remain visible to all in company
-- to avoid breaking existing data.

-- ── 1. Add owner_id columns ───────────────────────────────────────────────────

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES auth.users(id);

ALTER TABLE cariler
  ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES auth.users(id);

-- ── 2. orders RLS ────────────────────────────────────────────────────────────

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "company_isolation" ON orders;
DROP POLICY IF EXISTS "orders_update_company_isolation" ON orders;
DROP POLICY IF EXISTS "owner_role_access" ON orders;

-- SELECT / UPDATE / DELETE: own records + admin override + legacy NULL records
CREATE POLICY "owner_role_access" ON orders
  FOR ALL
  USING (
    company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
    AND (
      owner_id IS NULL
      OR owner_id = auth.uid()
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

-- ── 3. cariler RLS ───────────────────────────────────────────────────────────

ALTER TABLE cariler ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "company_isolation" ON cariler;
DROP POLICY IF EXISTS "owner_role_access" ON cariler;

CREATE POLICY "owner_role_access" ON cariler
  FOR ALL
  USING (
    company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
    AND (
      owner_id IS NULL
      OR owner_id = auth.uid()
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

-- ── Reset schema cache ────────────────────────────────────────────────────────
NOTIFY pgrst, 'reload schema';
