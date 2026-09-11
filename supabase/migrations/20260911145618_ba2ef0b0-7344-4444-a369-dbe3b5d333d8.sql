-- 1) Visitors may only cancel their own pending match requests
DROP POLICY IF EXISTS "Visitors can cancel own pending requests" ON public.doula_match_requests;
CREATE POLICY "Visitors can cancel own pending requests"
ON public.doula_match_requests
FOR UPDATE
TO authenticated
USING (visitor_user_id = auth.uid() AND status = 'pending')
WITH CHECK (visitor_user_id = auth.uid() AND status = 'cancelled');

-- 2) Prevent clients from tampering with privileged service_request fields
CREATE OR REPLACE FUNCTION public.restrict_client_service_request_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Admins, moderators, super admins and service_role bypass this restriction
  IF auth.uid() IS NULL
     OR public.is_super_admin()
     OR public.has_role(auth.uid(), 'admin'::app_role)
     OR public.has_role(auth.uid(), 'moderator'::app_role) THEN
    RETURN NEW;
  END IF;

  -- Only the owning client reaches here; restrict to rating fields
  IF EXISTS (
    SELECT 1 FROM public.clients c
    WHERE c.id = NEW.client_id AND c.user_id = auth.uid()
  ) THEN
    NEW.id := OLD.id;
    NEW.client_id := OLD.client_id;
    NEW.organization_id := OLD.organization_id;
    NEW.service_type := OLD.service_type;
    NEW.status := OLD.status;
    NEW.budget_value := OLD.budget_value;
    NEW.budget_sent_at := OLD.budget_sent_at;
    NEW.responded_at := OLD.responded_at;
    NEW.completed_at := OLD.completed_at;
    NEW.scheduled_date := OLD.scheduled_date;
    NEW.preferred_date := OLD.preferred_date;
    NEW.created_at := OLD.created_at;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS restrict_client_service_request_fields_trg ON public.service_requests;
CREATE TRIGGER restrict_client_service_request_fields_trg
BEFORE UPDATE ON public.service_requests
FOR EACH ROW
EXECUTE FUNCTION public.restrict_client_service_request_fields();