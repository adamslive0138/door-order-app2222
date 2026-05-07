-- ============================================================
-- Migration: cari_hareketler — fix column chain and finalize schema
--
-- Bug in previous migrations:
--   cari_hareketler_finalize.sql tried to backfill "transaction_type"
--   in step 2 (UPDATE ... SET transaction_type = type) but never ran
--   ADD COLUMN IF NOT EXISTS transaction_type first.
--   This migration corrects the full chain idempotently.
-- ============================================================

-- 1. Add transaction_type (was missing from finalize.sql step 1)
ALTER TABLE cari_hareketler
  ADD COLUMN IF NOT EXISTS transaction_type text
    CHECK (transaction_type IN ('tahsilat','odeme'));

-- 2. Add remaining new columns (idempotent)
ALTER TABLE cari_hareketler
  ADD COLUMN IF NOT EXISTS payment_method  text
    CHECK (payment_method IN ('nakit','havale','cek','senet','kredi_karti','diger')),
  ADD COLUMN IF NOT EXISTS transaction_date date,
  ADD COLUMN IF NOT EXISTS receipt_url      text,
  ADD COLUMN IF NOT EXISTS direction        text
    CHECK (direction IN ('in','out'));

-- 3. Backfill transaction_type from legacy "type" column
UPDATE cari_hareketler
  SET transaction_type = type
  WHERE transaction_type IS NULL AND type IS NOT NULL;

-- 4. Backfill transaction_date from legacy "hareket_date" column
UPDATE cari_hareketler
  SET transaction_date = hareket_date
  WHERE transaction_date IS NULL AND hareket_date IS NOT NULL;

-- 5. Backfill receipt_url from legacy "document_url" column
UPDATE cari_hareketler
  SET receipt_url = document_url
  WHERE receipt_url IS NULL AND document_url IS NOT NULL;

-- 6. Backfill direction from transaction_type
UPDATE cari_hareketler
  SET direction = CASE transaction_type WHEN 'tahsilat' THEN 'in' ELSE 'out' END
  WHERE direction IS NULL AND transaction_type IS NOT NULL;

-- 7. Re-apply CHECK constraint on transaction_type
ALTER TABLE cari_hareketler
  DROP CONSTRAINT IF EXISTS cari_hareketler_transaction_type_check;
ALTER TABLE cari_hareketler
  ADD CONSTRAINT cari_hareketler_transaction_type_check
  CHECK (transaction_type IN ('tahsilat','odeme'));

-- 8. Unique index on receipt_url (dedup guard)
DROP INDEX IF EXISTS idx_cari_hareketler_receipt_url;
CREATE UNIQUE INDEX IF NOT EXISTS idx_cari_hareketler_receipt_url
  ON cari_hareketler (receipt_url)
  WHERE receipt_url IS NOT NULL;

-- 9. Performance indexes
CREATE INDEX IF NOT EXISTS idx_cari_hareketler_cari_id_date
  ON cari_hareketler (cari_id, transaction_date DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_cari_hareketler_company_type
  ON cari_hareketler (company_id, transaction_type);

-- 10. Column comments
COMMENT ON COLUMN cari_hareketler.transaction_type  IS 'Canonical field: tahsilat | odeme';
COMMENT ON COLUMN cari_hareketler.transaction_date  IS 'Business date of the movement (replaces legacy hareket_date)';
COMMENT ON COLUMN cari_hareketler.receipt_url       IS 'Public URL of the receipt/document (replaces legacy document_url); dedup key';
COMMENT ON COLUMN cari_hareketler.direction         IS 'Derived from transaction_type: in = tahsilat, out = odeme';
COMMENT ON COLUMN cari_hareketler.payment_method    IS 'nakit | havale | cek | senet | kredi_karti | diger';

-- NOTE: Legacy columns (type, hareket_date, document_url) are intentionally
-- NOT dropped here because they may still be in use by older deployed code.
-- Once all app code references have been verified to use the new column names,
-- run the DROP statements below:
--
-- ALTER TABLE cari_hareketler
--   DROP COLUMN IF EXISTS type,
--   DROP COLUMN IF EXISTS hareket_date,
--   DROP COLUMN IF EXISTS document_url;

NOTIFY pgrst, 'reload schema';
