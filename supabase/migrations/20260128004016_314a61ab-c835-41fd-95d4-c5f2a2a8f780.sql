-- Add policy for clients to insert their own service request notifications
CREATE POLICY "Clients can insert own notifications" 
ON public.client_notifications 
FOR INSERT 
WITH CHECK (EXISTS (
  SELECT 1 FROM clients c
  WHERE c.id = client_notifications.client_id 
  AND c.user_id = auth.uid()
));