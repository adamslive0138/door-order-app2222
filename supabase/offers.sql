-- Offers (Teklifler) module
CREATE TABLE IF NOT EXISTS offers (
  id                 uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id         uuid        NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  teklif_no          text        NOT NULL,
  musteri_adi        text        NOT NULL,
  musteri_telefon    text,
  musteri_sehir      text,
  gecerlilik_tarihi  date,
  notlar             text,
  show_prices        boolean     NOT NULL DEFAULT true,
  items              jsonb       NOT NULL DEFAULT '[]',
  status             text        NOT NULL DEFAULT 'taslak'
                       CHECK (status IN ('taslak','gonderildi','kabul_edildi','reddedildi')),
  created_at         timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_offers_company_id ON offers (company_id);

ALTER TABLE offers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "company_isolation" ON offers
  USING  (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()))
  WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));
