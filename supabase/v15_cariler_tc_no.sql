-- v15: Add tc_no column to cariler table
-- TC kimlik numarası (Turkish national ID) — 11 digits, nullable

ALTER TABLE cariler
  ADD COLUMN IF NOT EXISTS tc_no text;

NOTIFY pgrst, 'reload schema';
