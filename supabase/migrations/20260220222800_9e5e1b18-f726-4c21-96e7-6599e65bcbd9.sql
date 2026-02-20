
-- Fix pregnancy_diary: allow moderators to read and manage
DROP POLICY IF EXISTS "Admins can manage all diary entries" ON public.pregnancy_diary;
CREATE POLICY "Admins and moderators can manage all diary entries"
  ON public.pregnancy_diary FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'moderator'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'moderator'::app_role));

-- Update the client SELECT policy for diary to include moderator
DROP POLICY IF EXISTS "Clients can view own diary entries" ON public.pregnancy_diary;
CREATE POLICY "Clients can view own diary entries"
  ON public.pregnancy_diary FOR SELECT
  USING (
    (EXISTS (SELECT 1 FROM clients c WHERE c.id = pregnancy_diary.client_id AND c.user_id = auth.uid()))
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'moderator'::app_role)
  );

-- Fix contractions: allow moderators
DROP POLICY IF EXISTS "Admins can manage all contractions" ON public.contractions;
CREATE POLICY "Admins and moderators can manage all contractions"
  ON public.contractions FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'moderator'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'moderator'::app_role));

DROP POLICY IF EXISTS "Clients can view own contractions" ON public.contractions;
CREATE POLICY "Clients can view own contractions"
  ON public.contractions FOR SELECT
  USING (
    (EXISTS (SELECT 1 FROM clients c WHERE c.id = contractions.client_id AND c.user_id = auth.uid()))
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'moderator'::app_role)
  );

-- Fix client_notifications: allow moderators
DROP POLICY IF EXISTS "Admins can manage all notifications" ON public.client_notifications;
CREATE POLICY "Admins and moderators can manage all notifications"
  ON public.client_notifications FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'moderator'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'moderator'::app_role));

DROP POLICY IF EXISTS "Clients can view own notifications" ON public.client_notifications;
CREATE POLICY "Clients can view own notifications"
  ON public.client_notifications FOR SELECT
  USING (
    (EXISTS (SELECT 1 FROM clients c WHERE c.id = client_notifications.client_id AND c.user_id = auth.uid()))
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'moderator'::app_role)
  );

-- Fix service_requests: allow moderators
DROP POLICY IF EXISTS "Admins can manage all service requests" ON public.service_requests;
CREATE POLICY "Admins and moderators can manage all service requests"
  ON public.service_requests FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'moderator'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'moderator'::app_role));
