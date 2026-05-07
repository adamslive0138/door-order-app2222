-- Add per-order KDV (VAT) rate column
-- Default 20 covers all existing records

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS kdv_rate numeric DEFAULT 20;
