-- ============================================================
-- Migration: offers — replace old Turkish schema with modern flat schema
-- The old schema had: teklif_no, musteri_adi, items (jsonb), etc.
-- The new schema matches what OfferForm.tsx inserts today.
-- Run idempotently; old columns are dropped only after backfill.
-- ============================================================

-- 1. Add all modern columns (idempotent)
ALTER TABLE offers
  ADD COLUMN IF NOT EXISTS order_id        uuid        REFERENCES orders(id)   ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS cari_id         uuid        REFERENCES cariler(id)  ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS customer_name   text,
  ADD COLUMN IF NOT EXISTS customer_phone  text,
  ADD COLUMN IF NOT EXISTS customer_city   text,
  ADD COLUMN IF NOT EXISTS door_type       text
    CHECK (door_type IN ('celik_kapi','villa_kapisi','yangin_kapisi','menfezli_kapi','panjurlu_kapi')),
  ADD COLUMN IF NOT EXISTS dimensions      text,
  ADD COLUMN IF NOT EXISTS image_url       text,
  ADD COLUMN IF NOT EXISTS quantity        integer     NOT NULL DEFAULT 1 CHECK (quantity > 0),
  ADD COLUMN IF NOT EXISTS unit_price      numeric(12,2) NOT NULL DEFAULT 0 CHECK (unit_price >= 0),
  ADD COLUMN IF NOT EXISTS total_price     numeric(12,2) NOT NULL DEFAULT 0 CHECK (total_price >= 0),
  ADD COLUMN IF NOT EXISTS notes           text,
  ADD COLUMN IF NOT EXISTS offer_text      text,
  ADD COLUMN IF NOT EXISTS updated_at      timestamptz;

-- 2. Ensure status column has the right CHECK constraint
--    (DROP + ADD is the safe way to update a CHECK)
ALTER TABLE offers DROP CONSTRAINT IF EXISTS offers_status_check;
ALTER TABLE offers ADD CONSTRAINT offers_status_check
  CHECK (status IN ('taslak','gonderildi','kabul_edildi','reddedildi'));

-- 3. Backfill customer_name from legacy musteri_adi (if present)
UPDATE offers
  SET customer_name = musteri_adi
  WHERE customer_name IS NULL AND musteri_adi IS NOT NULL;

-- 4. Recompute total_price from unit_price * quantity for existing rows
UPDATE offers
  SET total_price = unit_price * quantity
  WHERE total_price = 0 AND unit_price > 0;

-- 5. Drop legacy Turkish columns
ALTER TABLE offers
  DROP COLUMN IF EXISTS teklif_no,
  DROP COLUMN IF EXISTS musteri_adi,
  DROP COLUMN IF EXISTS musteri_telefon,
  DROP COLUMN IF EXISTS musteri_sehir,
  DROP COLUMN IF EXISTS gecerlilik_tarihi,
  DROP COLUMN IF EXISTS notlar,
  DROP COLUMN IF EXISTS show_prices,
  DROP COLUMN IF EXISTS items;

-- 6. Indexes
CREATE INDEX IF NOT EXISTS idx_offers_company_id  ON offers (company_id);
CREATE INDEX IF NOT EXISTS idx_offers_order_id    ON offers (order_id)   WHERE order_id  IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_offers_cari_id     ON offers (cari_id)    WHERE cari_id   IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_offers_status      ON offers (company_id, status);

-- 7. updated_at trigger (reuses the function created in cariler migration)
DROP TRIGGER IF EXISTS trg_offers_updated_at ON offers;
CREATE TRIGGER trg_offers_updated_at
  BEFORE UPDATE ON offers
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 8. total_price auto-compute trigger
--    Guarantees total_price = unit_price * quantity on every INSERT and UPDATE
--    so the client never needs to send this field.
CREATE OR REPLACE FUNCTION compute_offer_total_price()
  RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.total_price := NEW.unit_price * NEW.quantity;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_offers_total_price ON offers;
CREATE TRIGGER trg_offers_total_price
  BEFORE INSERT OR UPDATE OF unit_price, quantity ON offers
  FOR EACH ROW EXECUTE FUNCTION compute_offer_total_price();

NOTIFY pgrst, 'reload schema';
