-- v20: owner_id + role-based RLS for checks table
-- Run in Supabase SQL Editor.
--
-- Adds owner_id to checks.
-- RLS: admin sees all company checks (including legacy NULL).
--      satis sees only own records (owner_id = auth.uid()).
--      Legacy NULL records are NOT visible to satis — admin only.

-- ── 1. Add owner_id column ────────────────────────────────────────────────────

ALTER TABLE checks
  ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES auth.users(id);

CREATE INDEX IF NOT EXISTS idx_checks_owner_id ON checks (owner_id) WHERE owner_id IS NOT NULL;

-- ── 2. Drop existing policy, replace with owner-aware policy ─────────────────

ALTER TABLE checks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "company_isolation" ON checks;
DROP POLICY IF EXISTS "checks_owner_role_access" ON checks;

-- SELECT: admin sees all in company; satis sees own (legacy nulls hidden from satis)
-- INSERT / UPDATE WITH CHECK: satis can only write own records; admin unrestricted
CREATE POLICY "checks_owner_role_access" ON checks
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

-- ── 3. Reset schema cache ─────────────────────────────────────────────────────

NOTIFY pgrst, 'reload schema';
