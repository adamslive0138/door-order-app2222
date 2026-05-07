-- Migration: finalize cari_hareketler normalization
-- Additive approach (no renames) — run in Supabase SQL editor

-- 1. Add new columns if not already present
ALTER TABLE cari_hareketler
  ADD COLUMN IF NOT EXISTS transaction_date date,
  ADD COLUMN IF NOT EXISTS receipt_url      text,
  ADD COLUMN IF NOT EXISTS payment_method  text
    CHECK (payment_method IN ('nakit','havale','cek','senet','kredi_karti','diger')),
  ADD COLUMN IF NOT EXISTS direction        text
    CHECK (direction IN ('in','out'));

-- 2. Backfill transaction_type from legacy type column
UPDATE cari_hareketler
SET transaction_type = type
WHERE transaction_type IS NULL AND type IS NOT NULL;

-- 3. Backfill transaction_date from legacy hareket_date column
UPDATE cari_hareketler
SET transaction_date = hareket_date
WHERE transaction_date IS NULL AND hareket_date IS NOT NULL;

-- 4. Backfill receipt_url from legacy document_url column
UPDATE cari_hareketler
SET receipt_url = document_url
WHERE receipt_url IS NULL AND document_url IS NOT NULL;

-- 5. Backfill direction from transaction_type
UPDATE cari_hareketler
SET direction = CASE transaction_type WHEN 'tahsilat' THEN 'in' ELSE 'out' END
WHERE direction IS NULL AND transaction_type IS NOT NULL;

-- 6. Add CHECK constraint on transaction_type (if not already there)
ALTER TABLE cari_hareketler
  DROP CONSTRAINT IF EXISTS cari_hareketler_transaction_type_check;

ALTER TABLE cari_hareketler
  ADD CONSTRAINT cari_hareketler_transaction_type_check
  CHECK (transaction_type IN ('tahsilat','odeme'));

-- 7. Unique index on receipt_url for dedup guard
CREATE UNIQUE INDEX IF NOT EXISTS idx_cari_hareketler_receipt_url
  ON cari_hareketler (receipt_url)
  WHERE receipt_url IS NOT NULL;

-- 8. Comments
COMMENT ON COLUMN cari_hareketler.transaction_type  IS 'Normalized name for legacy "type" column';
COMMENT ON COLUMN cari_hareketler.transaction_date  IS 'Normalized name for legacy "hareket_date" column';
COMMENT ON COLUMN cari_hareketler.receipt_url       IS 'Normalized name for legacy "document_url"; dedup key';
COMMENT ON COLUMN cari_hareketler.direction         IS 'in = tahsilat, out = odeme';

-- 9. Schema cache reset
NOTIFY pgrst, 'reload schema';
