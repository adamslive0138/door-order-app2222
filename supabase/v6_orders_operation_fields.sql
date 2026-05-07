-- v6: Add operation tracking fields to orders table
-- operation_note: free-text note for production/delivery
-- *_date fields: key operational milestone dates

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS operation_note        text,
  ADD COLUMN IF NOT EXISTS production_start_date date,
  ADD COLUMN IF NOT EXISTS ready_date            date,
  ADD COLUMN IF NOT EXISTS shipped_date          date,
  ADD COLUMN IF NOT EXISTS delivered_date        date;
