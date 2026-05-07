-- Tighten stock_models RLS: write access restricted to admin role only.
-- SELECT remains open to all authenticated users in the same company.

DROP POLICY IF EXISTS "stock_models_select" ON stock_models;
DROP POLICY IF EXISTS "stock_models_insert" ON stock_models;
DROP POLICY IF EXISTS "stock_models_update" ON stock_models;
DROP POLICY IF EXISTS "stock_models_delete" ON stock_models;

CREATE POLICY "stock_models_select"
  ON stock_models FOR SELECT
  USING (
    company_id = (SELECT company_id FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY "stock_models_insert"
  ON stock_models FOR INSERT
  WITH CHECK (
    company_id = (SELECT company_id FROM profiles WHERE id = auth.uid())
    AND (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  );

CREATE POLICY "stock_models_update"
  ON stock_models FOR UPDATE
  USING (
    company_id = (SELECT company_id FROM profiles WHERE id = auth.uid())
    AND (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  );

CREATE POLICY "stock_models_delete"
  ON stock_models FOR DELETE
  USING (
    company_id = (SELECT company_id FROM profiles WHERE id = auth.uid())
    AND (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  );

-- Storage: restrict upload/delete to admin only
DROP POLICY IF EXISTS "stock_models_images_select" ON storage.objects;
CREATE POLICY "stock_models_images_select"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'stock-models' AND auth.role() = 'authenticated');

DROP POLICY IF EXISTS "stock_models_images_insert" ON storage.objects;
CREATE POLICY "stock_models_images_insert"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'stock-models'
    AND (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  );

DROP POLICY IF EXISTS "stock_models_images_delete" ON storage.objects;
CREATE POLICY "stock_models_images_delete"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'stock-models'
    AND (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  );
