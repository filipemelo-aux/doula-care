
-- Drop the old trigger that was based on payments table
DROP TRIGGER IF EXISTS sync_client_payment_status_trigger ON public.payments;

-- Create new trigger function based on transactions table
CREATE OR REPLACE FUNCTION public.sync_client_payment_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  total_amount numeric;
  total_received numeric;
  target_client_id uuid;
BEGIN
  target_client_id := COALESCE(NEW.client_id, OLD.client_id);
  
  IF target_client_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(SUM(amount), 0), COALESCE(SUM(amount_received), 0)
  INTO total_amount, total_received
  FROM transactions
  WHERE client_id = target_client_id AND type = 'receita';

  IF total_received >= total_amount AND total_amount > 0 THEN
    UPDATE clients SET payment_status = 'pago' WHERE id = target_client_id;
  ELSIF total_received > 0 AND total_received < total_amount THEN
    UPDATE clients SET payment_status = 'parcial' WHERE id = target_client_id;
  ELSE
    UPDATE clients SET payment_status = 'pendente' WHERE id = target_client_id;
  END IF;

  RETURN NEW;
END;
$function$;

-- Create trigger on transactions table
CREATE TRIGGER sync_client_payment_status_trigger
AFTER INSERT OR UPDATE ON public.transactions
FOR EACH ROW
EXECUTE FUNCTION public.sync_client_payment_status();
