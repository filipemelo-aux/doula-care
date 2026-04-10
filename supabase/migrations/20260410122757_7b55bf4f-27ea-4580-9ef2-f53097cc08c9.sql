
CREATE TABLE public.plan_payments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  plan_id uuid NOT NULL REFERENCES public.platform_plan_limits(id),
  order_nsu text NOT NULL UNIQUE,
  amount bigint NOT NULL,
  billing_type text NOT NULL CHECK (billing_type IN ('monthly', 'yearly')),
  status text NOT NULL DEFAULT 'pending',
  qr_code_base64 text,
  pix_code text,
  infinitepay_response jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.plan_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own plan payments"
  ON public.plan_payments FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own plan payments"
  ON public.plan_payments FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Super admins can manage all plan payments"
  ON public.plan_payments FOR ALL
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

CREATE TRIGGER update_plan_payments_updated_at
  BEFORE UPDATE ON public.plan_payments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
