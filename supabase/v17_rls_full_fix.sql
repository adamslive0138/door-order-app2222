-- v17: Full RLS fix for all tables
-- Run this in Supabase SQL Editor.
-- Fixes: cariler boş görünüyor, detay sayfaları 404, /finance/odeme 404
--
-- Root cause: profiles RLS policy prevents auth.uid() lookup from working inside
-- other tables' policies. Fix order matters: profiles first, then dependent tables.

-- ── 1. profiles ──────────────────────────────────────────────────────────────
-- Must allow SELECT on own row so that other tables' USING clauses can call
-- (SELECT company_id FROM profiles WHERE id = auth.uid()) without recursion.

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "company_isolation" ON profiles;
DROP POLICY IF EXISTS "select_own" ON profiles;

CREATE POLICY "select_own" ON profiles
  FOR SELECT USING (id = auth.uid());

CREATE POLICY "update_own" ON profiles
  FOR UPDATE USING (id = auth.uid()) WITH CHECK (id = auth.uid());

CREATE POLICY "insert_own" ON profiles
  FOR INSERT WITH CHECK (id = auth.uid());

-- ── 2. companies ─────────────────────────────────────────────────────────────

ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "company_isolation" ON companies;

CREATE POLICY "company_isolation" ON companies
  FOR ALL
  USING (
    id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
  )
  WITH CHECK (
    id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
  );

-- ── 3. cariler ───────────────────────────────────────────────────────────────

ALTER TABLE cariler ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "company_isolation" ON cariler;

CREATE POLICY "company_isolation" ON cariler
  FOR ALL
  USING (
    company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
  )
  WITH CHECK (
    company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
  );

-- ── 4. orders ────────────────────────────────────────────────────────────────

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "company_isolation" ON orders;
DROP POLICY IF EXISTS "orders_update_company_isolation" ON orders;

CREATE POLICY "company_isolation" ON orders
  FOR ALL
  USING (
    company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
  )
  WITH CHECK (
    company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
  );

-- ── 5. cari_hareketler ───────────────────────────────────────────────────────

ALTER TABLE cari_hareketler ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "company_isolation" ON cari_hareketler;

CREATE POLICY "company_isolation" ON cari_hareketler
  FOR ALL
  USING (
    company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
  )
  WITH CHECK (
    company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
  );

-- ── 6. offers ────────────────────────────────────────────────────────────────

ALTER TABLE offers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "company_isolation" ON offers;

CREATE POLICY "company_isolation" ON offers
  FOR ALL
  USING (
    company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
  )
  WITH CHECK (
    company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
  );

-- ── 7. checks ────────────────────────────────────────────────────────────────

ALTER TABLE checks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "company_isolation" ON checks;

CREATE POLICY "company_isolation" ON checks
  FOR ALL
  USING (
    company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
  )
  WITH CHECK (
    company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
  );

-- ── 8. documents ─────────────────────────────────────────────────────────────

ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "company_isolation" ON documents;

CREATE POLICY "company_isolation" ON documents
  FOR ALL
  USING (
    company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
  )
  WITH CHECK (
    company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
  );

-- ── Reset schema cache ────────────────────────────────────────────────────────
NOTIFY pgrst, 'reload schema';
