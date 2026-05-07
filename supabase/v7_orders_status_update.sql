-- v7: Align orders.status with new operational status model
-- Safe to run multiple times (idempotent via DROP IF EXISTS + IF NOT EXISTS patterns)

-- 1. Drop legacy constraint if it exists (name may vary — try common names)
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE orders DROP CONSTRAINT IF EXISTS chk_orders_status;

-- 2. Add constraint covering all new statuses + legacy values for backward compat
ALTER TABLE orders
  ADD CONSTRAINT orders_status_check CHECK (
    status IN (
      'beklemede',
      'onaylandi',
      'uretimde',
      'hazir',
      'sevkte',
      'teslim_edildi',
      'iptal',
      -- legacy values — kept so existing records remain valid
      'siparis_alindi',
      'gonderildi'
    )
  );

-- 3. Change column default for new orders
ALTER TABLE orders ALTER COLUMN status SET DEFAULT 'beklemede';
