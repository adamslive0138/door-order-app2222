-- v22: Fix checks visibility — enforce strict owner-based RLS
-- Run in Supabase SQL Editor.
--
-- Root cause: "company_isolation" policy (from v2/v17) was still active,
-- letting every company member see all checks regardless of owner_id.
-- Multiple policies on the same table combine with OR logic in Postgres,
-- so any permissive policy leaks access even if a strict one also exists.
--
-- This migration drops every known policy name on checks and creates
-- a single clean policy. Safe to re-run.
--
-- Result:
--   admin  → all checks in own company (owner_id NULL included)
--   satis  → only checks where owner_id = auth.uid()
--   NULL owner_id → admin only (legacy records not visible to satis)

-- ── 1. Ensure owner_id column exists (idempotent, safe to re-run) ─────────────

ALTER TABLE checks
  ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES auth.users(id);

CREATE INDEX IF NOT EXISTS idx_checks_owner_id
  ON checks (owner_id) WHERE owner_id IS NOT NULL;

-- ── 2. Drop ALL known policy names — leaves a clean slate ─────────────────────

ALTER TABLE checks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "company_isolation"       ON checks;
DROP POLICY IF EXISTS "checks_company_isolation" ON checks;
DROP POLICY IF EXISTS "owner_role_access"        ON checks;
DROP POLICY IF EXISTS "checks_owner_role_access" ON checks;

-- ── 3. Single authoritative policy ───────────────────────────────────────────

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

-- ── 4. Reset schema cache ─────────────────────────────────────────────────────

NOTIFY pgrst, 'reload schema';
