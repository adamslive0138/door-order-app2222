-- v16: Re-apply RLS policy for cariler (fixes empty list bug)
-- Run this in Supabase SQL Editor if cariler queries return 0 rows.

ALTER TABLE cariler ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "company_isolation" ON cariler;

CREATE POLICY "company_isolation"
ON cariler
FOR ALL
USING (
  company_id IN (
    SELECT company_id FROM profiles WHERE id = auth.uid()
  )
)
WITH CHECK (
  company_id IN (
    SELECT company_id FROM profiles WHERE id = auth.uid()
  )
);

NOTIFY pgrst, 'reload schema';
