CREATE OR REPLACE FUNCTION public.recompute_client_payment_status(p_client_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  total_amount numeric;
  total_received numeric;
BEGIN
  IF p_client_id IS NULL THEN
    RETURN;
  END IF;

  SELECT COALESCE(SUM(amount), 0), COALESCE(SUM(amount_received), 0)
  INTO total_amount, total_received
  FROM public.transactions
  WHERE client_id = p_client_id AND type = 'receita';

  IF total_received >= total_amount AND total_amount > 0 THEN
    UPDATE public.clients SET payment_status = 'pago' WHERE id = p_client_id;
  ELSIF total_received > 0 AND total_received < total_amount THEN
    UPDATE public.clients SET payment_status = 'parcial' WHERE id = p_client_id;
  ELSE
    UPDATE public.clients SET payment_status = 'pendente' WHERE id = p_client_id;
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.sync_client_payment_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  target_client_id uuid;
BEGIN
  target_client_id := COALESCE(NEW.client_id, OLD.client_id);
  PERFORM public.recompute_client_payment_status(target_client_id);
  RETURN COALESCE(NEW, OLD);
END;
$function$;

CREATE OR REPLACE FUNCTION public.sync_payment_rollups()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  target_transaction_id uuid;
  target_client_id uuid;
  paid_sum numeric := 0;
BEGIN
  IF COALESCE(auth.role(), '') = 'service_role' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  target_transaction_id := COALESCE(NEW.transaction_id, OLD.transaction_id);
  target_client_id := COALESCE(NEW.client_id, OLD.client_id);

  IF target_transaction_id IS NOT NULL THEN
    SELECT COALESCE(SUM(amount_paid), 0)
    INTO paid_sum
    FROM public.payments
    WHERE transaction_id = target_transaction_id;

    UPDATE public.transactions
    SET amount_received = GREATEST(COALESCE(amount_received, 0), paid_sum)
    WHERE id = target_transaction_id
      AND type = 'receita';
  END IF;

  PERFORM public.recompute_client_payment_status(target_client_id);

  RETURN COALESCE(NEW, OLD);
END;
$function$;