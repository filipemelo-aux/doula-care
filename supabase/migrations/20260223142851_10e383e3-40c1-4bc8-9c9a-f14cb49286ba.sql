
-- Auto-fill organization_id on transactions from client or caller profile
CREATE OR REPLACE FUNCTION public.auto_fill_organization_id_from_client()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- If organization_id is already set, skip
  IF NEW.organization_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Try to get from client_id if available
  IF NEW.client_id IS NOT NULL THEN
    SELECT organization_id INTO NEW.organization_id
    FROM clients
    WHERE id = NEW.client_id;
  END IF;

  -- If still null, try from caller's profile
  IF NEW.organization_id IS NULL AND auth.uid() IS NOT NULL THEN
    SELECT organization_id INTO NEW.organization_id
    FROM profiles
    WHERE user_id = auth.uid()
    LIMIT 1;
  END IF;

  RETURN NEW;
END;
$$;

-- Apply trigger to transactions
CREATE TRIGGER auto_fill_org_id_transactions
  BEFORE INSERT ON public.transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_fill_organization_id_from_client();

-- Apply trigger to payments
CREATE TRIGGER auto_fill_org_id_payments
  BEFORE INSERT ON public.payments
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_fill_organization_id_from_client();

-- Apply trigger to appointments
CREATE TRIGGER auto_fill_org_id_appointments
  BEFORE INSERT ON public.appointments
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_fill_organization_id_from_client();

-- Apply trigger to client_notifications
CREATE TRIGGER auto_fill_org_id_client_notifications
  BEFORE INSERT ON public.client_notifications
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_fill_organization_id_from_client();

-- Apply trigger to contractions
CREATE TRIGGER auto_fill_org_id_contractions
  BEFORE INSERT ON public.contractions
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_fill_organization_id_from_client();

-- Apply trigger to pregnancy_diary
CREATE TRIGGER auto_fill_org_id_pregnancy_diary
  BEFORE INSERT ON public.pregnancy_diary
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_fill_organization_id_from_client();

-- Apply trigger to service_requests
CREATE TRIGGER auto_fill_org_id_service_requests
  BEFORE INSERT ON public.service_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_fill_organization_id_from_client();
