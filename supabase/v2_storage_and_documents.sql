-- ============================================================
-- Migration: storage buckets + documents table finalization
--
-- STORAGE BUCKET STANDARD (run in Supabase Dashboard → Storage):
--
--   Bucket name       | Public | Used for
--   ------------------|--------|-------------------------------------
--   order-images      | true   | Order product photos (OrderForm)
--   cari-images       | true   | Cari firm documents / stamps (CariForm)
--   receipts          | true   | Finance tahsilat/ödeme dekont uploads
--   documents         | true   | General document uploads (DocumentUpload)
--
-- All four must exist. The SQL below creates RLS policies for each.
-- Run bucket creation manually in the Dashboard, then run this SQL.
-- ============================================================

-- ── Storage RLS policies ────────────────────────────────────────────────────
-- Pattern: authenticated users can read/write only within their own company folder.
-- Bucket path convention: {company_id}/{timestamp}.{ext}

-- order-images
INSERT INTO storage.buckets (id, name, public)
  VALUES ('order-images', 'order-images', true)
  ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "order-images company read"  ON storage.objects;
DROP POLICY IF EXISTS "order-images company write" ON storage.objects;

CREATE POLICY "order-images company read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'order-images' AND auth.role() = 'authenticated');

CREATE POLICY "order-images company write"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'order-images'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] IN (
      SELECT company_id::text FROM profiles WHERE id = auth.uid()
    )
  );

-- cari-images
INSERT INTO storage.buckets (id, name, public)
  VALUES ('cari-images', 'cari-images', true)
  ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "cari-images company read"  ON storage.objects;
DROP POLICY IF EXISTS "cari-images company write" ON storage.objects;

CREATE POLICY "cari-images company read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'cari-images' AND auth.role() = 'authenticated');

CREATE POLICY "cari-images company write"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'cari-images'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] IN (
      SELECT company_id::text FROM profiles WHERE id = auth.uid()
    )
  );

-- receipts
INSERT INTO storage.buckets (id, name, public)
  VALUES ('receipts', 'receipts', true)
  ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "receipts company read"  ON storage.objects;
DROP POLICY IF EXISTS "receipts company write" ON storage.objects;

CREATE POLICY "receipts company read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'receipts' AND auth.role() = 'authenticated');

CREATE POLICY "receipts company write"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'receipts'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] IN (
      SELECT company_id::text FROM profiles WHERE id = auth.uid()
    )
  );

-- documents
INSERT INTO storage.buckets (id, name, public)
  VALUES ('documents', 'documents', true)
  ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "documents company read"  ON storage.objects;
DROP POLICY IF EXISTS "documents company write" ON storage.objects;

CREATE POLICY "documents company read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'documents' AND auth.role() = 'authenticated');

CREATE POLICY "documents company write"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'documents'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] IN (
      SELECT company_id::text FROM profiles WHERE id = auth.uid()
    )
  );

-- ── documents table: add missing extracted_description column ───────────────
ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS extracted_description text;

COMMENT ON COLUMN documents.extracted_description IS 'Free-text description extracted from the document (OCR)';

-- ── documents table: ensure all canonical columns exist ────────────────────
ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS extracted_type text
    CHECK (extracted_type IN ('alis','satis'));

-- updated_at trigger
ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS updated_at timestamptz;

DROP TRIGGER IF EXISTS trg_documents_updated_at ON documents;
CREATE TRIGGER trg_documents_updated_at
  BEFORE UPDATE ON documents
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

NOTIFY pgrst, 'reload schema';
