-- ============================================================
-- Migration: orders — guarantee total_price = quantity * unit_price
--
-- Problem: OrderForm did not include total_price in its INSERT/UPDATE
-- payload, so orders were stored with total_price = DEFAULT 0.
-- All dashboard/report/finance queries reading total_price returned 0.
--
-- Fix:
--   1. BEFORE INSERT OR UPDATE trigger (same pattern as offers table)
--   2. Backfill existing rows where total_price is 0 but unit_price > 0
-- ============================================================

-- 1. Trigger function (reusable, idempotent)
CREATE OR REPLACE FUNCTION compute_order_total_price()
  RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.total_price := NEW.unit_price * NEW.quantity;
  RETURN NEW;
END;
$$;

-- 2. Attach trigger
DROP TRIGGER IF EXISTS trg_orders_total_price ON orders;
CREATE TRIGGER trg_orders_total_price
  BEFORE INSERT OR UPDATE OF unit_price, quantity ON orders
  FOR EACH ROW EXECUTE FUNCTION compute_order_total_price();

-- 3. Backfill existing rows that have total_price = 0 but unit_price > 0
UPDATE orders
  SET total_price = unit_price * quantity
  WHERE total_price = 0
    AND unit_price > 0;

NOTIFY pgrst, 'reload schema';
