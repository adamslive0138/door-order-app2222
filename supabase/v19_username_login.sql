-- v19: username-based login infrastructure
-- Run in Supabase SQL Editor.
--
-- Adds company code (for login screen) and username (per-user) without
-- breaking existing email-based auth or RLS/owner_id logic.

-- ── 1. companies.code ─────────────────────────────────────────────────────────
-- Short identifier shown on the login screen (e.g. "ABC123").
-- Case stored as-lowercase by the API route.

ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS code TEXT;

-- Globally unique; partial index ignores NULLs (companies not yet assigned a code)
CREATE UNIQUE INDEX IF NOT EXISTS companies_code_unique
  ON companies(code)
  WHERE code IS NOT NULL;

-- ── 2. profiles.username ──────────────────────────────────────────────────────
-- Unique within a company. Stored lowercase by the API route.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS username TEXT;

-- Unique per company; partial index ignores NULLs (legacy profiles without username)
CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_company_unique
  ON profiles(company_id, username)
  WHERE username IS NOT NULL;

-- ── Reset schema cache ────────────────────────────────────────────────────────
NOTIFY pgrst, 'reload schema';
