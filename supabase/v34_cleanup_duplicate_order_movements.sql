-- Remove duplicate auto-generated movements, keeping the newest row per order.
-- Safe to run multiple times (idempotent via the WHERE clause).
DELETE FROM cari_hareketler
WHERE id IN (
  SELECT id
  FROM (
    SELECT
      id,
      ROW_NUMBER() OVER (
        PARTITION BY linked_order_id
        ORDER BY created_at DESC
      ) AS rn
    FROM cari_hareketler
    WHERE linked_order_id IS NOT NULL
      AND is_auto_generated = true
  ) ranked
  WHERE rn > 1
);
