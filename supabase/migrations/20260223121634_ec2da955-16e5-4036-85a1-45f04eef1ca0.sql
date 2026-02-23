
-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Admins and moderators can manage all payments" ON public.payments;

-- Admins/moderators can only manage payments they own (multi-tenant isolation)
CREATE POLICY "Admins can manage own payments"
ON public.payments
FOR ALL
TO authenticated
USING (
  (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'moderator'))
  AND owner_id = auth.uid()
)
WITH CHECK (
  (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'moderator'))
  AND owner_id = auth.uid()
);
