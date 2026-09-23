UPDATE public.transactions
SET amount_received = amount,
    updated_at = now()
WHERE type = 'despesa'
  AND COALESCE(amount_received, 0) = 0;

CREATE OR REPLACE FUNCTION public.set_expense_payment(
  p_transaction_id uuid,
  p_paid boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_expense public.transactions%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  SELECT * INTO v_expense
  FROM public.transactions
  WHERE id = p_transaction_id
    AND type = 'despesa';

  IF v_expense.id IS NULL THEN
    RAISE EXCEPTION 'Conta não encontrada';
  END IF;

  IF NOT (
    public.is_super_admin()
    OR (
      v_expense.organization_id = public.get_user_organization_id()
      AND public.has_role(v_user_id, 'admin'::public.app_role)
    )
  ) THEN
    RAISE EXCEPTION 'Sem permissão para alterar esta conta';
  END IF;

  UPDATE public.transactions
  SET amount_received = CASE WHEN p_paid THEN amount ELSE 0 END,
      updated_at = now()
  WHERE id = p_transaction_id;
END;
$$;

REVOKE ALL ON FUNCTION public.set_expense_payment(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_expense_payment(uuid, boolean) TO authenticated, service_role;