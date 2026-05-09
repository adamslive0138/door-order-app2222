-- =====================================================================
-- v31_production_cleanup.sql
-- Production hardening: RLS tightening, indexes, trigger fix, constraints
-- Apply in Supabase SQL editor (Dashboard → SQL editor → Run).
-- =====================================================================


-- ─────────────────────────────────────────────────────────────────────
-- 1. RLS: cari_hareketler
--    Was: single "company_isolation" FOR ALL → any company member can
--         UPDATE and DELETE financial movement records.
--    Fix: SELECT + INSERT remain open to whole company;
--         UPDATE + DELETE restricted to admin | finans only.
-- ─────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "company_isolation"          ON cari_hareketler;
DROP POLICY IF EXISTS "cari_hareketler_select"     ON cari_hareketler;
DROP POLICY IF EXISTS "cari_hareketler_insert"     ON cari_hareketler;
DROP POLICY IF EXISTS "cari_hareketler_update"     ON cari_hareketler;
DROP POLICY IF EXISTS "cari_hareketler_delete"     ON cari_hareketler;

CREATE POLICY "cari_hareketler_select"
  ON cari_hareketler FOR SELECT
  USING (company_id = (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "cari_hareketler_insert"
  ON cari_hareketler FOR INSERT
  WITH CHECK (company_id = (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "cari_hareketler_update"
  ON cari_hareketler FOR UPDATE
  USING (
    company_id = (SELECT company_id FROM profiles WHERE id = auth.uid())
    AND (SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin','finans')
  )
  WITH CHECK (
    company_id = (SELECT company_id FROM profiles WHERE id = auth.uid())
    AND (SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin','finans')
  );

CREATE POLICY "cari_hareketler_delete"
  ON cari_hareketler FOR DELETE
  USING (
    company_id = (SELECT company_id FROM profiles WHERE id = auth.uid())
    AND (SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin','finans')
  );


-- ─────────────────────────────────────────────────────────────────────
-- 2. RLS: offers
--    Was: "company_isolation" FOR ALL → any company member can DELETE.
--    Fix: SELECT / INSERT / UPDATE open to company; DELETE → admin only.
-- ─────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "company_isolation" ON offers;
DROP POLICY IF EXISTS "offers_select"    ON offers;
DROP POLICY IF EXISTS "offers_insert"    ON offers;
DROP POLICY IF EXISTS "offers_update"    ON offers;
DROP POLICY IF EXISTS "offers_delete"    ON offers;

CREATE POLICY "offers_select"
  ON offers FOR SELECT
  USING (company_id = (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "offers_insert"
  ON offers FOR INSERT
  WITH CHECK (company_id = (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "offers_update"
  ON offers FOR UPDATE
  USING   (company_id = (SELECT company_id FROM profiles WHERE id = auth.uid()))
  WITH CHECK (company_id = (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "offers_delete"
  ON offers FOR DELETE
  USING (
    company_id = (SELECT company_id FROM profiles WHERE id = auth.uid())
    AND (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  );


-- ─────────────────────────────────────────────────────────────────────
-- 3. RLS: documents
--    Was: "company_isolation" FOR ALL → any company member can UPDATE/DELETE.
--    Fix: SELECT + INSERT open to company;
--         UPDATE + DELETE → admin | operasyon (mirrors docs_edit permission).
-- ─────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "company_isolation"  ON documents;
DROP POLICY IF EXISTS "documents_select"   ON documents;
DROP POLICY IF EXISTS "documents_insert"   ON documents;
DROP POLICY IF EXISTS "documents_update"   ON documents;
DROP POLICY IF EXISTS "documents_delete"   ON documents;

CREATE POLICY "documents_select"
  ON documents FOR SELECT
  USING (company_id = (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "documents_insert"
  ON documents FOR INSERT
  WITH CHECK (company_id = (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "documents_update"
  ON documents FOR UPDATE
  USING (
    company_id = (SELECT company_id FROM profiles WHERE id = auth.uid())
    AND (SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin','operasyon')
  )
  WITH CHECK (
    company_id = (SELECT company_id FROM profiles WHERE id = auth.uid())
    AND (SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin','operasyon')
  );

CREATE POLICY "documents_delete"
  ON documents FOR DELETE
  USING (
    company_id = (SELECT company_id FROM profiles WHERE id = auth.uid())
    AND (SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin','operasyon')
  );


-- ─────────────────────────────────────────────────────────────────────
-- 4. RLS: checks
--    Was: "checks_owner_role_access" FOR ALL → record owner could DELETE.
--    Fix: drop FOR ALL, recreate SELECT/INSERT/UPDATE for owner|admin,
--         DELETE restricted to admin only.
-- ─────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "checks_owner_role_access" ON checks;
DROP POLICY IF EXISTS "checks_select"            ON checks;
DROP POLICY IF EXISTS "checks_insert"            ON checks;
DROP POLICY IF EXISTS "checks_update"            ON checks;
DROP POLICY IF EXISTS "checks_delete"            ON checks;

CREATE POLICY "checks_select"
  ON checks FOR SELECT
  USING (
    company_id = (SELECT company_id FROM profiles WHERE id = auth.uid())
    AND (owner_id = auth.uid() OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin')
  );

CREATE POLICY "checks_insert"
  ON checks FOR INSERT
  WITH CHECK (
    company_id = (SELECT company_id FROM profiles WHERE id = auth.uid())
    AND (SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin','finans','operasyon')
  );

CREATE POLICY "checks_update"
  ON checks FOR UPDATE
  USING (
    company_id = (SELECT company_id FROM profiles WHERE id = auth.uid())
    AND (owner_id = auth.uid() OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin')
  )
  WITH CHECK (
    company_id = (SELECT company_id FROM profiles WHERE id = auth.uid())
    AND (owner_id = auth.uid() OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin')
  );

CREATE POLICY "checks_delete"
  ON checks FOR DELETE
  USING (
    company_id = (SELECT company_id FROM profiles WHERE id = auth.uid())
    AND (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  );


-- ─────────────────────────────────────────────────────────────────────
-- 5. Missing performance indexes
-- ─────────────────────────────────────────────────────────────────────

-- Orders: owner filtering (filtered per-owner for non-admin staff)
CREATE INDEX IF NOT EXISTS idx_orders_owner_id
  ON orders (owner_id)
  WHERE owner_id IS NOT NULL;

-- Orders: archive filter used on every list query
CREATE INDEX IF NOT EXISTS idx_orders_is_archived
  ON orders (company_id, is_archived);

-- Orders: dashboard timeline sorts by created_at
CREATE INDEX IF NOT EXISTS idx_orders_created_at
  ON orders (company_id, created_at DESC);

-- Stock models: company lookup
CREATE INDEX IF NOT EXISTS idx_stock_models_company_id
  ON stock_models (company_id);

-- Cariler: owner filtering
CREATE INDEX IF NOT EXISTS idx_cariler_owner_id
  ON cariler (owner_id)
  WHERE owner_id IS NOT NULL;


-- ─────────────────────────────────────────────────────────────────────
-- 6. Fix compute_order_total_price trigger
--    Was: total_price = unit_price × quantity
--         → ignores multi-item JSONB and KDV; gives wrong totals.
--    Fix: when items JSONB is present, sum item subtotals + apply kdv_rate.
--         Legacy orders (no items) keep the original formula.
-- ─────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION compute_order_total_price()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_items_total numeric := 0;
  v_kdv_pct     numeric := 0;
BEGIN
  IF NEW.items IS NOT NULL
     AND jsonb_typeof(NEW.items) = 'array'
     AND jsonb_array_length(NEW.items) > 0
  THEN
    -- Multi-item order: sum each item's (quantity × unit_price) then add KDV
    SELECT COALESCE(SUM(
      COALESCE((elem->>'quantity')::numeric,   0) *
      COALESCE((elem->>'unit_price')::numeric, 0)
    ), 0)
    INTO v_items_total
    FROM jsonb_array_elements(NEW.items) AS elem;

    -- kdv_rate = 0 means KDV-exempt; default 0 when not set so we don't fabricate tax
    v_kdv_pct     := COALESCE(NEW.kdv_rate, 0);
    NEW.total_price := ROUND(v_items_total * (1 + v_kdv_pct / 100.0), 2);
  ELSE
    -- Legacy single-item order
    NEW.total_price := ROUND(
      COALESCE(NEW.unit_price, 0) * COALESCE(NEW.quantity, 0), 2
    );
  END IF;
  RETURN NEW;
END;
$$;

-- Extend trigger to also fire when items or kdv_rate change
DROP TRIGGER IF EXISTS trg_orders_total_price ON orders;
CREATE TRIGGER trg_orders_total_price
  BEFORE INSERT OR UPDATE OF unit_price, quantity, items, kdv_rate
  ON orders
  FOR EACH ROW EXECUTE FUNCTION compute_order_total_price();


-- ─────────────────────────────────────────────────────────────────────
-- 7. stock_models: add updated_at + trigger (was missing entirely)
-- ─────────────────────────────────────────────────────────────────────
ALTER TABLE stock_models
  ADD COLUMN IF NOT EXISTS updated_at timestamptz;

DROP TRIGGER IF EXISTS trg_stock_models_updated_at ON stock_models;
CREATE TRIGGER trg_stock_models_updated_at
  BEFORE UPDATE ON stock_models
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ─────────────────────────────────────────────────────────────────────
-- 8. stock_models: enforce non-negative stock count constraints
--    right_count / left_count were nullable with no lower-bound check.
-- ─────────────────────────────────────────────────────────────────────
UPDATE stock_models SET right_count = 0 WHERE right_count IS NULL;
UPDATE stock_models SET left_count  = 0 WHERE left_count  IS NULL;

ALTER TABLE stock_models
  ALTER COLUMN right_count SET NOT NULL,
  ALTER COLUMN right_count SET DEFAULT 0,
  ALTER COLUMN left_count  SET NOT NULL,
  ALTER COLUMN left_count  SET DEFAULT 0;

ALTER TABLE stock_models
  DROP CONSTRAINT IF EXISTS stock_models_right_count_check,
  DROP CONSTRAINT IF EXISTS stock_models_left_count_check;

ALTER TABLE stock_models
  ADD CONSTRAINT stock_models_right_count_check CHECK (right_count >= 0),
  ADD CONSTRAINT stock_models_left_count_check  CHECK (left_count  >= 0);


-- ─────────────────────────────────────────────────────────────────────
-- 9. cariler.company_id FK: add ON DELETE CASCADE
--    Was: no cascade (RESTRICT) → orphaned rows remain when company deleted.
--    Uses dynamic SQL to drop the existing FK regardless of auto-name.
-- ─────────────────────────────────────────────────────────────────────
DO $$
DECLARE v_cname text;
BEGIN
  SELECT constraint_name INTO v_cname
  FROM   information_schema.table_constraints
  WHERE  table_schema    = 'public'
    AND  table_name      = 'cariler'
    AND  constraint_type = 'FOREIGN KEY'
    AND  constraint_name LIKE '%company_id%'
    AND  constraint_name != 'cariler_company_id_cascade_fkey'
  LIMIT 1;

  IF v_cname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE cariler DROP CONSTRAINT %I', v_cname);
  END IF;
END;
$$;

ALTER TABLE cariler
  ADD CONSTRAINT cariler_company_id_cascade_fkey
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;


-- ─────────────────────────────────────────────────────────────────────
-- 10. Storage: re-assert stock-models bucket safety settings
-- ─────────────────────────────────────────────────────────────────────
UPDATE storage.buckets
SET
  public             = true,
  file_size_limit    = 5242880,   -- 5 MB
  allowed_mime_types = ARRAY['image/jpeg','image/png','image/webp','image/gif']
WHERE id = 'stock-models';
