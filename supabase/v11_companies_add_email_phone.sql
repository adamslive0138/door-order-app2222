-- Migration v11: Add email and phone columns to companies table
--
-- The companies table was created without these columns.
-- Both the settings page and signup route reference them.

ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS phone text;

NOTIFY pgrst, 'reload schema';
