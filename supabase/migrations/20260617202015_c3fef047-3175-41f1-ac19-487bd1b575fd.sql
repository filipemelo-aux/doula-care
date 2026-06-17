
-- Allow guards to be bypassed inside controlled SECURITY DEFINER reversal
CREATE OR REPLACE FUNCTION public.guard_payment_history()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  jwt_role text := COALESCE(auth.role(), '');
  allow_estorno text := current_setting('app.allow_estorno', true);
BEGIN
  IF jwt_role = 'service_role' OR allow_estorno = 'on' THEN
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
  allow_estorno text := current_setting('app.allow_estorno', true);
  paid_sum numeric := 0;
BEGIN
  IF jwt_role = 'service_role' OR allow_estorno = 'on' THEN
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

-- Intentional reversal RPC: callable by admin/moderator of the same org
CREATE OR REPLACE FUNCTION public.revert_installment_payment(p_payment_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_org_id uuid;
  v_payment record;
  v_new_received numeric := 0;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  SELECT * INTO v_payment FROM public.payments WHERE id = p_payment_id;
  IF v_payment.id IS NULL THEN
    RAISE EXCEPTION 'Parcela não encontrada';
  END IF;

  v_org_id := v_payment.organization_id;

  IF NOT (is_super_admin() OR (
    v_org_id = get_user_organization_id()
    AND (has_role(v_user_id, 'admin'::app_role) OR has_role(v_user_id, 'moderator'::app_role))
  )) THEN
    RAISE EXCEPTION 'Sem permissão para estornar';
  END IF;

  PERFORM set_config('app.allow_estorno', 'on', true);

  UPDATE public.payments
  SET amount_paid = 0,
      paid_at = NULL,
      status = 'pendente'
  WHERE id = p_payment_id;

  IF v_payment.transaction_id IS NOT NULL THEN
    SELECT COALESCE(SUM(amount_paid), 0)
    INTO v_new_received
    FROM public.payments
    WHERE transaction_id = v_payment.transaction_id;

    UPDATE public.transactions
    SET amount_received = v_new_received
    WHERE id = v_payment.transaction_id;
  END IF;

  PERFORM public.recompute_client_payment_status(v_payment.client_id);

  PERFORM set_config('app.allow_estorno', 'off', true);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.revert_installment_payment(uuid) TO authenticated;
