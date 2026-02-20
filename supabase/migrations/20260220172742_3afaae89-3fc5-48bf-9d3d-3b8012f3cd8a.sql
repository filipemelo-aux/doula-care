
CREATE OR REPLACE FUNCTION public.sync_client_payment_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  total_amount numeric;
  total_paid numeric;
  target_client_id uuid;
BEGIN
  target_client_id := COALESCE(NEW.client_id, OLD.client_id);

  SELECT COALESCE(SUM(amount), 0), COALESCE(SUM(amount_paid), 0)
  INTO total_amount, total_paid
  FROM payments
  WHERE client_id = target_client_id;

  IF total_paid >= total_amount AND total_amount > 0 THEN
    UPDATE clients SET payment_status = 'pago' WHERE id = target_client_id;
  ELSIF total_paid > 0 AND total_paid < total_amount THEN
    UPDATE clients SET payment_status = 'parcial' WHERE id = target_client_id;
  ELSE
    UPDATE clients SET payment_status = 'pendente' WHERE id = target_client_id;
  END IF;

  RETURN NEW;
END;
$function$;

CREATE TRIGGER sync_client_payment_status_trigger
AFTER INSERT OR UPDATE ON public.payments
FOR EACH ROW
EXECUTE FUNCTION public.sync_client_payment_status();
