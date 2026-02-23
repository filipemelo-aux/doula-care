
-- Add due_date to org_billing
ALTER TABLE public.org_billing
  ADD COLUMN IF NOT EXISTS due_date date,
  ADD COLUMN IF NOT EXISTS notify_on_create boolean NOT NULL DEFAULT true;

-- Table for org-level notifications (billing alerts for doulas)
CREATE TABLE public.org_notifications (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  title text NOT NULL,
  message text NOT NULL,
  type text NOT NULL DEFAULT 'billing',
  billing_id uuid REFERENCES public.org_billing(id) ON DELETE SET NULL,
  read boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.org_notifications ENABLE ROW LEVEL SECURITY;

-- Super admins can manage all org notifications
CREATE POLICY "Super admins can manage all org notifications"
  ON public.org_notifications FOR ALL
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- Admins can view and update own org notifications
CREATE POLICY "Admins can view own org notifications"
  ON public.org_notifications FOR SELECT
  USING ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'moderator'::app_role)) AND organization_id = get_user_organization_id());

CREATE POLICY "Admins can update own org notifications"
  ON public.org_notifications FOR UPDATE
  USING ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'moderator'::app_role)) AND organization_id = get_user_organization_id())
  WITH CHECK ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'moderator'::app_role)) AND organization_id = get_user_organization_id());
