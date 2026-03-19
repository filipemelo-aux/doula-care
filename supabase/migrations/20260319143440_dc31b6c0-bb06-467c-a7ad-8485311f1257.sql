-- Remove client insert policy on client_notifications (admin-only table)
DROP POLICY IF EXISTS "Clients can insert own notifications" ON public.client_notifications;

-- Fix organizations update policy: change from public to authenticated
DROP POLICY IF EXISTS "Admins can update own org branding" ON public.organizations;

CREATE POLICY "Admins can update own org branding"
ON public.organizations
FOR UPDATE
TO authenticated
USING (
  (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'moderator'::app_role))
  AND id = get_user_organization_id()
)
WITH CHECK (
  (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'moderator'::app_role))
  AND id = get_user_organization_id()
);