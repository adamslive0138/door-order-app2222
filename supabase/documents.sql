-- Fatura / Belge Merkezi
CREATE TABLE IF NOT EXISTS documents (
  id                   uuid          DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id           uuid          NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  file_url             text          NOT NULL,
  file_type            text          NOT NULL DEFAULT 'diger'
                         CHECK (file_type IN ('fatura', 'dekont', 'diger')),
  extracted_name       text,
  extracted_amount     numeric(12,2),
  extracted_date       date,
  extracted_tax_number text,
  extracted_type       text          CHECK (extracted_type IN ('alis', 'satis')),
  linked_cari_id       uuid          REFERENCES cariler(id) ON DELETE SET NULL,
  is_processed         boolean       NOT NULL DEFAULT false,
  is_duplicate         boolean       NOT NULL DEFAULT false,
  created_at           timestamptz   DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_documents_company_id    ON documents (company_id);
CREATE INDEX IF NOT EXISTS idx_documents_linked_cari   ON documents (linked_cari_id);

ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "company_isolation" ON documents
  USING (
    company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
  )
  WITH CHECK (
    company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
  );

-- Storage bucket: documents
-- Run manually in Supabase dashboard → Storage → New bucket → "documents" (public)
