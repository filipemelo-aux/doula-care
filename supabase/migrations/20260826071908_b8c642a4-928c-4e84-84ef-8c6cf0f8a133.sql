CREATE POLICY "Clients can create own notifications"
ON public.client_notifications
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.clients c
    WHERE c.id = client_notifications.client_id
      AND c.user_id = auth.uid()
      AND c.organization_id IS NOT DISTINCT FROM client_notifications.organization_id
  )
);