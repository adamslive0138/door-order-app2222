-- cari_hareketler: accounting movements per cari
CREATE TABLE IF NOT EXISTS cari_hareketler (
  id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id  uuid        NOT NULL REFERENCES companies(id)  ON DELETE CASCADE,
  cari_id     uuid        NOT NULL REFERENCES cariler(id)    ON DELETE CASCADE,
  type        text        NOT NULL CHECK (type IN ('tahsilat', 'odeme')),
  amount      numeric(12, 2) NOT NULL CHECK (amount > 0),
  description text,
  created_at  timestamptz DEFAULT now() NOT NULL
);

-- Index for fast per-cari lookups
CREATE INDEX IF NOT EXISTS idx_cari_hareketler_cari_id
  ON cari_hareketler (cari_id);

CREATE INDEX IF NOT EXISTS idx_cari_hareketler_company_id
  ON cari_hareketler (company_id);

-- Row Level Security
ALTER TABLE cari_hareketler ENABLE ROW LEVEL SECURITY;

CREATE POLICY "company_isolation" ON cari_hareketler
  USING (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  );
