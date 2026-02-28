CREATE POLICY "Clients can view own org custom services"
ON public.custom_services
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM clients c
    WHERE c.user_id = auth.uid()
      AND c.organization_id = custom_services.organization_id
  )
);