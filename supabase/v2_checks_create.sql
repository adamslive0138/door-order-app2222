-- ============================================================
-- Migration: checks — create çek/senet takip table
-- ============================================================

CREATE TABLE IF NOT EXISTS checks (
  id               uuid          DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id       uuid          NOT NULL REFERENCES companies(id)  ON DELETE CASCADE,

  -- Cari links
  source_cari_id   uuid          REFERENCES cariler(id) ON DELETE SET NULL,
  target_cari_id   uuid          REFERENCES cariler(id) ON DELETE SET NULL,

  -- Check direction and status
  check_direction  text          NOT NULL DEFAULT 'alindi'
    CHECK (check_direction IN ('alindi','verildi')),
  check_status     text          NOT NULL DEFAULT 'portfoy'
    CHECK (check_status IN ('portfoy','devredildi','tahsil_edildi','iade')),

  -- Check details
  check_no         text,
  bank_name        text,
  branch_name      text,
  account_no       text,
  amount           numeric(12,2) NOT NULL CHECK (amount > 0),
  due_date         date          NOT NULL,
  issue_date       date,
  description      text,
  receipt_url      text,

  -- Timestamps
  created_at       timestamptz   DEFAULT now() NOT NULL,
  updated_at       timestamptz
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_checks_company_id     ON checks (company_id);
CREATE INDEX IF NOT EXISTS idx_checks_source_cari    ON checks (source_cari_id) WHERE source_cari_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_checks_target_cari    ON checks (target_cari_id) WHERE target_cari_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_checks_due_date       ON checks (company_id, due_date);
CREATE INDEX IF NOT EXISTS idx_checks_status         ON checks (company_id, check_status);

-- updated_at trigger
DROP TRIGGER IF EXISTS trg_checks_updated_at ON checks;
CREATE TRIGGER trg_checks_updated_at
  BEFORE UPDATE ON checks
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- RLS
ALTER TABLE checks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "company_isolation" ON checks
  USING  (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()))
  WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

-- Column comments
COMMENT ON COLUMN checks.check_direction IS 'alindi = received from source_cari, verildi = given to target_cari';
COMMENT ON COLUMN checks.check_status    IS 'portfoy | devredildi | tahsil_edildi | iade';
COMMENT ON COLUMN checks.source_cari_id  IS 'Cari who gave the check (always set on alindi)';
COMMENT ON COLUMN checks.target_cari_id  IS 'Cari this check was transferred to (set when devredildi)';

NOTIFY pgrst, 'reload schema';
