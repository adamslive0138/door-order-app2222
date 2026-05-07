-- ============================================================
-- Migration: storage — make receipts and documents buckets private
--
-- Bucket access model (final):
--
--   Bucket         | public | Used for
--   ---------------|--------|------------------------------------------
--   order-images   | true   | Product photos — shown in <img> throughout app
--   cari-images    | true   | Firm stamps/documents — shown in <img> in cari detail
--   receipts       | false  | Financial receipts (tahsilat/ödeme dekontları)
--   documents      | false  | Invoices and uploaded financial documents
--
-- Private bucket access:
--   - Objects are NOT accessible via public URL
--   - Authenticated users in the same company can read via signed URLs
--   - Signed URLs are generated server-side at render time (1 hour TTL)
-- ============================================================

-- ── Make receipts and documents private ──────────────────────────────────────

UPDATE storage.buckets
  SET public = false
  WHERE id IN ('receipts', 'documents');

-- ── receipts: write policy (company-folder isolation) ────────────────────────

DROP POLICY IF EXISTS "receipts company read"  ON storage.objects;
DROP POLICY IF EXISTS "receipts company write" ON storage.objects;

-- Only authenticated users from the same company can upload
CREATE POLICY "receipts company write"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'receipts'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] IN (
      SELECT company_id::text FROM profiles WHERE id = auth.uid()
    )
  );

-- Only authenticated users from the same company can read
CREATE POLICY "receipts company read"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'receipts'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] IN (
      SELECT company_id::text FROM profiles WHERE id = auth.uid()
    )
  );

-- ── documents: write policy (company-folder isolation) ───────────────────────

DROP POLICY IF EXISTS "documents company read"  ON storage.objects;
DROP POLICY IF EXISTS "documents company write" ON storage.objects;

-- Only authenticated users from the same company can upload
CREATE POLICY "documents company write"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'documents'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] IN (
      SELECT company_id::text FROM profiles WHERE id = auth.uid()
    )
  );

-- Only authenticated users from the same company can read
CREATE POLICY "documents company read"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'documents'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] IN (
      SELECT company_id::text FROM profiles WHERE id = auth.uid()
    )
  );

-- ── order-images: keep public, tighten write-only RLS ────────────────────────

DROP POLICY IF EXISTS "order-images company read"  ON storage.objects;
DROP POLICY IF EXISTS "order-images company write" ON storage.objects;

CREATE POLICY "order-images company read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'order-images');

CREATE POLICY "order-images company write"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'order-images'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] IN (
      SELECT company_id::text FROM profiles WHERE id = auth.uid()
    )
  );

-- ── cari-images: keep public, tighten write-only RLS ─────────────────────────

DROP POLICY IF EXISTS "cari-images company read"  ON storage.objects;
DROP POLICY IF EXISTS "cari-images company write" ON storage.objects;

CREATE POLICY "cari-images company read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'cari-images');

CREATE POLICY "cari-images company write"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'cari-images'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] IN (
      SELECT company_id::text FROM profiles WHERE id = auth.uid()
    )
  );

NOTIFY pgrst, 'reload schema';
