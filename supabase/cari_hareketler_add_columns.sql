-- Migration: add hareket_date and document_url to cari_hareketler
-- Run this in Supabase SQL editor

ALTER TABLE cari_hareketler
  ADD COLUMN IF NOT EXISTS hareket_date date,
  ADD COLUMN IF NOT EXISTS document_url  text;

-- Unique index: one hareket per source document (prevents double-processing)
CREATE UNIQUE INDEX IF NOT EXISTS idx_cari_hareketler_document_url
  ON cari_hareketler (document_url)
  WHERE document_url IS NOT NULL;

COMMENT ON COLUMN cari_hareketler.hareket_date IS 'Date on the source document (invoice/receipt date)';
COMMENT ON COLUMN cari_hareketler.document_url  IS 'Public URL of the source document; used as dedup key';
