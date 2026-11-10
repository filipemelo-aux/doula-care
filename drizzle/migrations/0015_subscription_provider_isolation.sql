ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS environment text NOT NULL DEFAULT 'unknown';
UPDATE public.subscriptions SET environment = 'production' WHERE platform IN ('web', 'pix') OR stripe_subscription_id IS NOT NULL;
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS auto_renew boolean;
REVOKE INSERT, UPDATE, DELETE ON public.subscriptions FROM anon, authenticated;
GRANT SELECT ON public.subscriptions TO authenticated;
GRANT ALL ON public.subscriptions TO service_role;
CREATE INDEX IF NOT EXISTS subscriptions_provider_identity_idx ON public.subscriptions (user_id, platform, environment);
CREATE OR REPLACE FUNCTION public.reconcile_subscription_plan(p_user_id uuid) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_org uuid; v_plan text; v_end timestamptz; v_promo public.org_promotions%ROWTYPE;
BEGIN
 SELECT organization_id INTO v_org FROM public.profiles WHERE user_id=p_user_id;
 IF v_org IS NULL THEN RETURN 'free'; END IF;
 PERFORM 1 FROM public.organizations WHERE id=v_org FOR UPDATE;
 SELECT s.*, l.plan INTO v_promo FROM public.org_promotions s LEFT JOIN public.platform_plan_limits l ON false WHERE false;
 SELECT * INTO v_promo FROM public.org_promotions WHERE organization_id=v_org AND status='lifetime_active' LIMIT 1;
 IF FOUND THEN RETURN 'premium'; END IF;
 SELECT l.plan, s.current_period_end INTO v_plan,v_end FROM public.subscriptions s JOIN public.profiles p ON p.user_id=s.user_id JOIN public.platform_plan_limits l ON l.id=s.plan_id
 WHERE p.organization_id=v_org AND s.environment='production' AND ((s.status='active' AND (s.current_period_end IS NULL OR s.current_period_end>now())) OR (s.status IN ('active','pending','grace_period','billing_issue') AND s.current_period_end+interval '3 days'>now()))
 ORDER BY CASE l.plan WHEN 'premium' THEN 2 WHEN 'pro' THEN 1 ELSE 0 END DESC, s.current_period_end DESC NULLS LAST LIMIT 1;
 IF v_plan IS NULL THEN
 SELECT * INTO v_promo FROM public.org_promotions WHERE organization_id=v_org AND status='trial_active' AND trial_ends_at>now() ORDER BY trial_ends_at DESC LIMIT 1;
 IF FOUND THEN RETURN 'premium'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.subscriptions s JOIN public.profiles p ON p.user_id=s.user_id WHERE p.organization_id=v_org AND s.environment='production') THEN RETURN (SELECT plan::text FROM public.organizations WHERE id=v_org); END IF;
 v_plan:='free';
 END IF;
 UPDATE public.organizations SET plan=v_plan::public.org_plan, next_billing_date=v_end::date, updated_at=now() WHERE id=v_org;
 RETURN v_plan;
END; $$;
REVOKE ALL ON FUNCTION public.reconcile_subscription_plan(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reconcile_subscription_plan(uuid) TO service_role;