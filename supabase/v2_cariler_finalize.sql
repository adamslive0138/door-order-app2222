-- ============================================================
-- Migration: cariler — drop legacy Turkish columns
-- Run AFTER verifying that English columns hold all live data.
-- Safe to run multiple times (all ops are idempotent).
-- ============================================================

-- 1. Ensure all English columns exist (defensive)
ALTER TABLE cariler
  ADD COLUMN IF NOT EXISTS firm_name    text,
  ADD COLUMN IF NOT EXISTS contact_name text,
  ADD COLUMN IF NOT EXISTS phone        text,
  ADD COLUMN IF NOT EXISTS email        text,
  ADD COLUMN IF NOT EXISTS city         text,
  ADD COLUMN IF NOT EXISTS address      text,
  ADD COLUMN IF NOT EXISTS tax_office   text,
  ADD COLUMN IF NOT EXISTS tax_number   text,
  ADD COLUMN IF NOT EXISTS notes        text,
  ADD COLUMN IF NOT EXISTS image_url    text,
  ADD COLUMN IF NOT EXISTS cari_type    text
    CHECK (cari_type IN ('musteri','tedarikci','her_ikisi')),
  ADD COLUMN IF NOT EXISTS updated_at   timestamptz;

-- 2. Backfill English columns from Turkish ones (only if English is NULL)
UPDATE cariler SET firm_name    = firma_adi       WHERE firm_name    IS NULL AND firma_adi       IS NOT NULL;
UPDATE cariler SET contact_name = yetkili_adi     WHERE contact_name IS NULL AND yetkili_adi     IS NOT NULL;
UPDATE cariler SET phone        = telefon         WHERE phone        IS NULL AND telefon         IS NOT NULL;
UPDATE cariler SET email        = eposta          WHERE email        IS NULL AND eposta          IS NOT NULL;
UPDATE cariler SET city         = sehir           WHERE city         IS NULL AND sehir           IS NOT NULL;
UPDATE cariler SET address      = adres           WHERE address      IS NULL AND adres           IS NOT NULL;
UPDATE cariler SET tax_office   = vergi_dairesi   WHERE tax_office   IS NULL AND vergi_dairesi   IS NOT NULL;
UPDATE cariler SET tax_number   = vergi_no        WHERE tax_number   IS NULL AND vergi_no        IS NOT NULL;
UPDATE cariler SET notes        = notlar          WHERE notes        IS NULL AND notlar          IS NOT NULL;
UPDATE cariler SET cari_type    = cari_tipi       WHERE cari_type    IS NULL AND cari_tipi       IS NOT NULL;

-- 3. Drop legacy Turkish columns
--    (comment out any line if you suspect data still lives there)
ALTER TABLE cariler
  DROP COLUMN IF EXISTS firma_adi,
  DROP COLUMN IF EXISTS yetkili_adi,
  DROP COLUMN IF EXISTS telefon,
  DROP COLUMN IF EXISTS eposta,
  DROP COLUMN IF EXISTS sehir,
  DROP COLUMN IF EXISTS adres,
  DROP COLUMN IF EXISTS vergi_dairesi,
  DROP COLUMN IF EXISTS vergi_no,
  DROP COLUMN IF EXISTS notlar,
  DROP COLUMN IF EXISTS cari_tipi;

-- 4. Make firm_name and cari_type NOT NULL (safe once backfill is done)
--    Uncomment once you're sure all rows have values:
-- ALTER TABLE cariler ALTER COLUMN firm_name  SET NOT NULL;
-- ALTER TABLE cariler ALTER COLUMN cari_type  SET NOT NULL;

-- 5. Indexes
CREATE INDEX IF NOT EXISTS idx_cariler_company_id ON cariler (company_id);
CREATE INDEX IF NOT EXISTS idx_cariler_cari_type  ON cariler (company_id, cari_type);

-- 6. updated_at trigger (creates or replaces)
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cariler_updated_at ON cariler;
CREATE TRIGGER trg_cariler_updated_at
  BEFORE UPDATE ON cariler
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

NOTIFY pgrst, 'reload schema';
