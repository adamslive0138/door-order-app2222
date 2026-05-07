-- ============================================================
-- Migration v14: RLS policies for cariler, companies, profiles
--
-- cariler   → standard company_isolation (same as orders/documents/etc.)
-- companies → id IS the company; USING checks id against profile's company_id
-- profiles  → id = auth.uid() to avoid recursive self-reference
--             (SELECT ... FROM profiles inside a profiles policy causes recursion)
-- ============================================================

-- ── cariler ──────────────────────────────────────────────────────────────────

ALTER TABLE cariler ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "company_isolation" ON cariler;

CREATE POLICY "company_isolation" ON cariler
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

-- ── companies ────────────────────────────────────────────────────────────────
-- companies.id is the primary key and is referenced as company_id everywhere.
-- A user may only access the company they belong to.

ALTER TABLE companies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "company_isolation" ON companies;

CREATE POLICY "company_isolation" ON companies
  USING (
    id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  );

-- ── profiles ─────────────────────────────────────────────────────────────────
-- profiles.id = auth.uid() (FK to auth.users).
-- Using a subquery on profiles inside a profiles policy would cause
-- infinite recursion. id = auth.uid() achieves the same isolation safely.

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "company_isolation" ON profiles;

CREATE POLICY "company_isolation" ON profiles
  USING     (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- ── Schema cache reset ────────────────────────────────────────────────────────

NOTIFY pgrst, 'reload schema';
