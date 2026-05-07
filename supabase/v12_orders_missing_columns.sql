-- ============================================================
-- Migration v12: Add all missing columns to orders table
--
-- Two groups:
--
-- A) Material / lock fields — sent by OrderForm but never added
--    by any prior migration. Causes silent insert failures when
--    PostgREST rejects unknown columns (or silently drops them).
--
-- B) Operation date fields — same as v6 (idempotent re-run in
--    case v6 was skipped; this is what caused the "delivered_date
--    column does not exist" runtime error).
-- ============================================================

-- ── A. Material / lock fields ────────────────────────────────────────────────
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS lock_brand         text,
  ADD COLUMN IF NOT EXISTS lock_system        text,
  ADD COLUMN IF NOT EXISTS frame_color        text,
  ADD COLUMN IF NOT EXISTS mdf_thickness      text,
  ADD COLUMN IF NOT EXISTS mdf_thickness_other text,
  ADD COLUMN IF NOT EXISTS steel_thickness    text;

-- ── B. Operation / milestone date fields (idempotent v6 re-run) ─────────────
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS operation_note        text,
  ADD COLUMN IF NOT EXISTS production_start_date date,
  ADD COLUMN IF NOT EXISTS ready_date            date,
  ADD COLUMN IF NOT EXISTS shipped_date          date,
  ADD COLUMN IF NOT EXISTS delivered_date        date;

NOTIFY pgrst, 'reload schema';
