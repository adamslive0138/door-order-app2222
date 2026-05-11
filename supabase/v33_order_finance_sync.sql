-- Add columns to track order-linked auto-generated finance movements
ALTER TABLE cari_hareketler
  ADD COLUMN IF NOT EXISTS linked_order_id uuid REFERENCES orders(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_auto_generated boolean NOT NULL DEFAULT false;

-- Enforce one auto-generated movement per order
CREATE UNIQUE INDEX IF NOT EXISTS cari_hareketler_order_uniq
  ON cari_hareketler (linked_order_id)
  WHERE linked_order_id IS NOT NULL AND is_auto_generated = true;
