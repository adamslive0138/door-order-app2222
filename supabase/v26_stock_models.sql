-- Hazır kapı modeli kütüphanesi
-- Gerçek stok/depo sistemi değil — sadece model referansı

CREATE TABLE IF NOT EXISTS stock_models (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      uuid        NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name            text        NOT NULL,
  image_url       text,
  measurement     text,
  right_count     integer     DEFAULT 0,
  left_count      integer     DEFAULT 0,
  door_type       text,
  lock_brand      text,
  lock_system     text,
  frame_color     text,
  mdf_thickness   text,
  sheet_thickness text,
  wing_thickness  text,
  notes           text,
  created_at      timestamptz DEFAULT now()
);

-- RLS
ALTER TABLE stock_models ENABLE ROW LEVEL SECURITY;

-- Company isolation: admin + satis görebilir ve ekleyebilir
CREATE POLICY "stock_models_select" ON stock_models
  FOR SELECT USING (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "stock_models_insert" ON stock_models
  FOR INSERT WITH CHECK (
    company_id IN (
      SELECT company_id FROM profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'satis')
    )
  );

CREATE POLICY "stock_models_delete" ON stock_models
  FOR DELETE USING (
    company_id IN (
      SELECT company_id FROM profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'satis')
    )
  );

-- Storage bucket for model images (run via Supabase dashboard if needed)
-- INSERT INTO storage.buckets (id, name, public) VALUES ('stock-models', 'stock-models', false)
-- ON CONFLICT DO NOTHING;
