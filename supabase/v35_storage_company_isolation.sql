-- v35: Tighten storage and RLS company isolation
--
-- Fixes:
--   1. stock-models SELECT was open to any authenticated user — scope to company folder
--   2. payment_approvals satis_select_own lacked company_id — add for consistency
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. stock-models storage: scope SELECT to company folder ──────────────────

DROP POLICY IF EXISTS "stock_models_images_select" ON storage.objects;

CREATE POLICY "stock_models_images_select"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'stock-models'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = (
      SELECT company_id::text FROM profiles WHERE id = auth.uid()
    )
  );

-- ── 2. payment_approvals: add company_id guard to satis SELECT ───────────────
-- owner_id = auth.uid() is technically sufficient (UIDs are globally unique),
-- but explicit company_id is consistent with every other policy in this schema.

DROP POLICY IF EXISTS "satis_select_own" ON payment_approvals;

CREATE POLICY "satis_select_own" ON payment_approvals
  FOR SELECT
  USING (
    owner_id = auth.uid()
    AND company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  );

NOTIFY pgrst, 'reload schema';
