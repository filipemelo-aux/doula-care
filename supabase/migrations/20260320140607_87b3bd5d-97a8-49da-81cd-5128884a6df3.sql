
-- Add action type column to track what happened
ALTER TABLE public.org_access_log ADD COLUMN action text NOT NULL DEFAULT 'login';

-- Create index for action-based queries
CREATE INDEX idx_org_access_log_action ON public.org_access_log (action, accessed_at DESC);

-- Trigger function: log activity on INSERT into key tables
CREATE OR REPLACE FUNCTION public.log_org_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.organization_id IS NOT NULL THEN
    INSERT INTO public.org_access_log (user_id, organization_id, action)
    VALUES (
      COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid),
      NEW.organization_id,
      TG_ARGV[0]
    );
  END IF;
  RETURN NEW;
END;
$$;

-- Track client creation
CREATE TRIGGER trg_log_client_created
  AFTER INSERT ON public.clients
  FOR EACH ROW
  EXECUTE FUNCTION public.log_org_activity('client_created');

-- Track appointment creation
CREATE TRIGGER trg_log_appointment_created
  AFTER INSERT ON public.appointments
  FOR EACH ROW
  EXECUTE FUNCTION public.log_org_activity('appointment_created');

-- Track notification sent
CREATE TRIGGER trg_log_notification_sent
  AFTER INSERT ON public.client_notifications
  FOR EACH ROW
  EXECUTE FUNCTION public.log_org_activity('notification_sent');

-- Track diary entry
CREATE TRIGGER trg_log_diary_entry
  AFTER INSERT ON public.pregnancy_diary
  FOR EACH ROW
  EXECUTE FUNCTION public.log_org_activity('diary_entry');

-- Track contract created
CREATE TRIGGER trg_log_contract_created
  AFTER INSERT ON public.client_contracts
  FOR EACH ROW
  EXECUTE FUNCTION public.log_org_activity('contract_created');

-- Track payment created
CREATE TRIGGER trg_log_payment_created
  AFTER INSERT ON public.payments
  FOR EACH ROW
  EXECUTE FUNCTION public.log_org_activity('payment_created');

-- Track service request
CREATE TRIGGER trg_log_service_request
  AFTER INSERT ON public.service_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.log_org_activity('service_request');
