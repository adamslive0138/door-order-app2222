-- v9: Add role field to profiles
-- Run in Supabase Dashboard → SQL Editor

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS role text DEFAULT 'admin';

-- Set all existing users to admin (they had full access before)
UPDATE profiles SET role = 'admin' WHERE role IS NULL;

ALTER TABLE profiles ALTER COLUMN role SET NOT NULL;
ALTER TABLE profiles ALTER COLUMN role SET DEFAULT 'admin';

ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('admin', 'satis', 'finans', 'operasyon'));
