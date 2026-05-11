-- =====================================================================
-- v32_company_settings.sql
-- Extended company settings for PDF/document customisation
-- Apply in Supabase SQL editor (Dashboard → SQL editor → Run).
-- =====================================================================


-- ─────────────────────────────────────────────────────────────────────
-- 1. company_settings table
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS company_settings (
  id           uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id   uuid          NOT NULL UNIQUE REFERENCES companies(id) ON DELETE CASCADE,
  company_name text,
  logo_url     text,
  phone        text,
  email        text,
  address      text,
  tax_office   text,
  tax_number   text,
  default_kdv  numeric(5,2)  DEFAULT 20,
  footer_note  text,
  bank_info    text,
  created_at   timestamptz   DEFAULT now(),
  updated_at   timestamptz   DEFAULT now()
);

-- updated_at trigger (reuses set_updated_at() from earlier migrations)
DROP TRIGGER IF EXISTS trg_company_settings_updated_at ON company_settings;
CREATE TRIGGER trg_company_settings_updated_at
  BEFORE UPDATE ON company_settings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ─────────────────────────────────────────────────────────────────────
-- 2. RLS
-- ─────────────────────────────────────────────────────────────────────
ALTER TABLE company_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "company_settings_select" ON company_settings;
DROP POLICY IF EXISTS "company_settings_insert" ON company_settings;
DROP POLICY IF EXISTS "company_settings_update" ON company_settings;

CREATE POLICY "company_settings_select"
  ON company_settings FOR SELECT
  USING (company_id = (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "company_settings_insert"
  ON company_settings FOR INSERT
  WITH CHECK (company_id = (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "company_settings_update"
  ON company_settings FOR UPDATE
  USING   (company_id = (SELECT company_id FROM profiles WHERE id = auth.uid()))
  WITH CHECK (company_id = (SELECT company_id FROM profiles WHERE id = auth.uid()));


-- ─────────────────────────────────────────────────────────────────────
-- 3. company-logos storage bucket
--    Upsert so this is safe to run if bucket already exists.
-- ─────────────────────────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'company-logos',
  'company-logos',
  true,
  3145728,
  ARRAY['image/jpeg','image/png','image/webp','image/gif']
)
ON CONFLICT (id) DO UPDATE SET
  public             = true,
  file_size_limit    = 3145728,
  allowed_mime_types = ARRAY['image/jpeg','image/png','image/webp','image/gif'];

-- Storage RLS for company-logos bucket
-- Drop possible old catch-all policy then add per-operation policies.
DROP POLICY IF EXISTS "company_logos_public_select" ON storage.objects;
DROP POLICY IF EXISTS "company_logos_auth_all"      ON storage.objects;
DROP POLICY IF EXISTS "company_logos_select"        ON storage.objects;
DROP POLICY IF EXISTS "company_logos_insert"        ON storage.objects;
DROP POLICY IF EXISTS "company_logos_update"        ON storage.objects;
DROP POLICY IF EXISTS "company_logos_delete"        ON storage.objects;

CREATE POLICY "company_logos_select"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'company-logos');

CREATE POLICY "company_logos_insert"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'company-logos'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = (
      SELECT company_id::text FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "company_logos_update"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'company-logos'
    AND (storage.foldername(name))[1] = (
      SELECT company_id::text FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "company_logos_delete"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'company-logos'
    AND (storage.foldername(name))[1] = (
      SELECT company_id::text FROM profiles WHERE id = auth.uid()
    )
  );
