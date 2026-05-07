-- ============================================================
-- Migration v10: Defensive constraint fixes
--
-- 1. Ensure cari_hareketler.transaction_type allows all 4 values
--    (alacak / borc added by v3; this is idempotent in case v3 was skipped)
-- 2. Ensure checks.check_direction has the correct 2-value constraint
--    (defensive fix for the reported checks_check_direction_check error)
-- ============================================================

-- ── 1. cari_hareketler.transaction_type ──────────────────────────────────────

-- Drop old constraint regardless of how many values it has
ALTER TABLE cari_hareketler
  DROP CONSTRAINT IF EXISTS cari_hareketler_transaction_type_check;

-- Re-add with all 4 values
ALTER TABLE cari_hareketler
  ADD CONSTRAINT cari_hareketler_transaction_type_check
  CHECK (transaction_type IN ('tahsilat', 'odeme', 'alacak', 'borc'));

-- Backfill: OrderForm-generated pseudo-tahsilat rows → alacak
-- (Safe to run multiple times; condition is tight enough to avoid false positives)
UPDATE cari_hareketler
  SET transaction_type = 'alacak'
  WHERE transaction_type = 'tahsilat'
    AND receipt_url    IS NULL
    AND payment_method IS NULL
    AND description    LIKE 'Sipariş:%';

-- ── 2. checks.check_direction ────────────────────────────────────────────────

-- Drop and re-add to guarantee the constraint name matches what the app expects
ALTER TABLE checks
  DROP CONSTRAINT IF EXISTS checks_check_direction_check;

ALTER TABLE checks
  ADD CONSTRAINT checks_check_direction_check
  CHECK (check_direction IN ('alindi', 'verildi'));

-- ── 3. Rebuild index on transaction_type (in case it was dropped by v3) ─────

DROP INDEX IF EXISTS idx_cari_hareketler_company_type;
CREATE INDEX IF NOT EXISTS idx_cari_hareketler_company_type
  ON cari_hareketler (company_id, transaction_type);

NOTIFY pgrst, 'reload schema';
