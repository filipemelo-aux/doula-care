CREATE OR REPLACE FUNCTION public.update_payment_status()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.amount_paid >= NEW.amount AND NEW.amount > 0 THEN
    NEW.status := 'pago';
    IF NEW.paid_at IS NULL THEN
      NEW.paid_at := now();
    END IF;
  ELSIF NEW.amount_paid > 0 AND NEW.amount_paid < NEW.amount THEN
    NEW.status := 'parcial';
  ELSE
    NEW.status := 'pendente';
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.guard_payment_history()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  jwt_role text := COALESCE(auth.role(), '');
BEGIN
  IF jwt_role = 'service_role' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF TG_OP = 'DELETE' THEN
    IF COALESCE(OLD.amount_paid, 0) > 0 THEN
      RAISE EXCEPTION 'Pagamento recebido não pode ser excluído';
    END IF;
    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF COALESCE(OLD.amount_paid, 0) > 0 THEN
      IF COALESCE(NEW.amount_paid, 0) < COALESCE(OLD.amount_paid, 0) THEN
        RAISE EXCEPTION 'Valor recebido não pode ser reduzido';
      END IF;

      IF NEW.amount IS DISTINCT FROM OLD.amount
        OR NEW.due_date IS DISTINCT FROM OLD.due_date
        OR NEW.installment_number IS DISTINCT FROM OLD.installment_number
        OR NEW.client_id IS DISTINCT FROM OLD.client_id
        OR (OLD.transaction_id IS NOT NULL AND NEW.transaction_id IS DISTINCT FROM OLD.transaction_id) THEN
        RAISE EXCEPTION 'Parcela com pagamento recebido não pode ter agenda, valor ou vínculo alterado';
      END IF;

      IF OLD.paid_at IS NOT NULL AND NEW.paid_at IS NULL THEN
        NEW.paid_at := OLD.paid_at;
      END IF;

      IF OLD.payment_method IS NOT NULL AND NEW.payment_method IS NULL THEN
        NEW.payment_method := OLD.payment_method;
      END IF;
    END IF;

    RETURN NEW;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$function$;

CREATE OR REPLACE FUNCTION public.guard_transaction_payment_history()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  jwt_role text := COALESCE(auth.role(), '');
  paid_sum numeric := 0;
BEGIN
  IF jwt_role = 'service_role' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF TG_OP = 'DELETE' THEN
    SELECT COALESCE(SUM(amount_paid), 0)
    INTO paid_sum
    FROM public.payments
    WHERE transaction_id = OLD.id;

    IF OLD.type = 'receita' AND (COALESCE(OLD.amount_received, 0) > 0 OR paid_sum > 0) THEN
      RAISE EXCEPTION 'Receita com pagamento recebido não pode ser excluída';
    END IF;

    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.type = 'receita' THEN
    SELECT COALESCE(SUM(amount_paid), 0)
    INTO paid_sum
    FROM public.payments
    WHERE transaction_id = OLD.id;

    IF COALESCE(NEW.amount_received, 0) < COALESCE(OLD.amount_received, 0) THEN
      RAISE EXCEPTION 'Total recebido não pode ser reduzido';
    END IF;

    IF COALESCE(NEW.amount_received, 0) < paid_sum THEN
      RAISE EXCEPTION 'Total recebido não pode ficar abaixo das parcelas pagas';
    END IF;
  END IF;

  RETURN NEW;
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

  IF target_client_id IS NOT NULL THEN
    PERFORM public.sync_client_payment_status();
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$function$;

DROP TRIGGER IF EXISTS payments_00_guard_history_update ON public.payments;
DROP TRIGGER IF EXISTS payments_00_guard_history_delete ON public.payments;
DROP TRIGGER IF EXISTS payments_10_update_status ON public.payments;
DROP TRIGGER IF EXISTS payments_90_sync_rollups ON public.payments;
DROP TRIGGER IF EXISTS transactions_00_guard_payment_history_update ON public.transactions;
DROP TRIGGER IF EXISTS transactions_00_guard_payment_history_delete ON public.transactions;
DROP TRIGGER IF EXISTS transactions_90_sync_client_payment_status ON public.transactions;

CREATE TRIGGER payments_00_guard_history_update
BEFORE UPDATE ON public.payments
FOR EACH ROW
EXECUTE FUNCTION public.guard_payment_history();

CREATE TRIGGER payments_00_guard_history_delete
BEFORE DELETE ON public.payments
FOR EACH ROW
EXECUTE FUNCTION public.guard_payment_history();

CREATE TRIGGER payments_10_update_status
BEFORE INSERT OR UPDATE ON public.payments
FOR EACH ROW
EXECUTE FUNCTION public.update_payment_status();

CREATE TRIGGER payments_90_sync_rollups
AFTER INSERT OR UPDATE OR DELETE ON public.payments
FOR EACH ROW
EXECUTE FUNCTION public.sync_payment_rollups();

CREATE TRIGGER transactions_00_guard_payment_history_update
BEFORE UPDATE ON public.transactions
FOR EACH ROW
EXECUTE FUNCTION public.guard_transaction_payment_history();

CREATE TRIGGER transactions_00_guard_payment_history_delete
BEFORE DELETE ON public.transactions
FOR EACH ROW
EXECUTE FUNCTION public.guard_transaction_payment_history();

CREATE TRIGGER transactions_90_sync_client_payment_status
AFTER INSERT OR UPDATE OR DELETE ON public.transactions
FOR EACH ROW
EXECUTE FUNCTION public.sync_client_payment_status();