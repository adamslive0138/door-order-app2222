-- v8: Add cari_status to cariler table
-- Values: aktif | pasif | arsiv   (default: aktif)

-- 1. Add nullable column first (so existing rows are not rejected)
ALTER TABLE cariler
  ADD COLUMN IF NOT EXISTS cari_status text DEFAULT 'aktif';

-- 2. Backfill existing rows
UPDATE cariler SET cari_status = 'aktif' WHERE cari_status IS NULL;

-- 3. Enforce NOT NULL
ALTER TABLE cariler ALTER COLUMN cari_status SET NOT NULL;

-- 4. Add check constraint
ALTER TABLE cariler DROP CONSTRAINT IF EXISTS cariler_cari_status_check;
ALTER TABLE cariler
  ADD CONSTRAINT cariler_cari_status_check
  CHECK (cari_status IN ('aktif', 'pasif', 'arsiv'));
