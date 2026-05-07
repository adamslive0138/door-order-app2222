-- Restrict DELETE on orders and cariler to admin role only.
-- SELECT / INSERT / UPDATE remain unchanged for existing policies.

-- orders DELETE
DROP POLICY IF EXISTS "orders_delete" ON orders;
CREATE POLICY "orders_delete"
  ON orders FOR DELETE
  USING (
    company_id = (SELECT company_id FROM profiles WHERE id = auth.uid())
    AND (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  );

-- cariler DELETE
DROP POLICY IF EXISTS "cariler_delete" ON cariler;
CREATE POLICY "cariler_delete"
  ON cariler FOR DELETE
  USING (
    company_id = (SELECT company_id FROM profiles WHERE id = auth.uid())
    AND (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  );
