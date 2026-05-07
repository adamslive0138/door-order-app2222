-- ============================================================
-- Migration: cari_hareketler — extend transaction_type to 4 values
--
-- New model:
--   alacak   = receivable created by a sale (we are owed money)
--   borc     = payable created by a purchase (we owe money)
--   tahsilat = actual cash received
--   odeme    = actual cash paid
--
-- Bakiye formula (from company perspective):
--   net = (alacak + odeme) - (borc + tahsilat)
--   positive net → the other party owes us
--   negative net → we owe the other party
--
-- Backfill strategy:
--   Records inserted by OrderForm are reliably identified by:
--     - transaction_type = 'tahsilat'
--     - description LIKE 'Sipariş:%'
--     - receipt_url IS NULL
--     - payment_method IS NULL
--   These represent receivables created by orders, not real cash.
--   They are converted to 'alacak'.
-- ============================================================

-- 1. Drop old 2-value CHECK, add new 4-value CHECK
ALTER TABLE cari_hareketler
  DROP CONSTRAINT IF EXISTS cari_hareketler_transaction_type_check;

ALTER TABLE cari_hareketler
  ADD CONSTRAINT cari_hareketler_transaction_type_check
  CHECK (transaction_type IN ('tahsilat','odeme','alacak','borc'));

-- 2. Backfill: OrderForm-generated pseudo-tahsilat → alacak
UPDATE cari_hareketler
  SET transaction_type = 'alacak'
  WHERE transaction_type = 'tahsilat'
    AND receipt_url    IS NULL
    AND payment_method IS NULL
    AND description    LIKE 'Sipariş:%';

-- 3. Add index for the new type values
DROP INDEX IF EXISTS idx_cari_hareketler_company_type;
CREATE INDEX IF NOT EXISTS idx_cari_hareketler_company_type
  ON cari_hareketler (company_id, transaction_type);

NOTIFY pgrst, 'reload schema';
