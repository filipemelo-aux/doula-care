-- Allow clients to view their own transactions (revenue records)
CREATE POLICY "Clients can view own transactions"
ON public.transactions FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM clients c
    WHERE c.id = transactions.client_id
    AND c.user_id = auth.uid()
  )
);
