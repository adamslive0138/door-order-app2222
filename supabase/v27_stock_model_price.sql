-- Add price column to stock_models
ALTER TABLE stock_models
  ADD COLUMN IF NOT EXISTS price numeric DEFAULT 0;

-- Create the stock-models storage bucket (public — no signed URLs needed)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'stock-models',
  'stock-models',
  true,
  5242880,
  ARRAY['image/jpeg','image/png','image/webp','image/gif']
)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Storage RLS policies (drop-then-create is the correct idempotent pattern in PostgreSQL)
DROP POLICY IF EXISTS "stock_models_images_select" ON storage.objects;
CREATE POLICY "stock_models_images_select"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'stock-models' AND auth.role() = 'authenticated');

DROP POLICY IF EXISTS "stock_models_images_insert" ON storage.objects;
CREATE POLICY "stock_models_images_insert"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'stock-models' AND auth.role() = 'authenticated');

DROP POLICY IF EXISTS "stock_models_images_delete" ON storage.objects;
CREATE POLICY "stock_models_images_delete"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'stock-models' AND auth.role() = 'authenticated');
