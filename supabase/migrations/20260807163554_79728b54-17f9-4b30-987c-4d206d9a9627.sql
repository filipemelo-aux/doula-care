UPDATE public.organizations SET plan = 'pro', updated_at = now() WHERE plan = 'free';

UPDATE public.org_promotions SET status = 'cancelled', updated_at = now() WHERE status = 'trial_active';

DELETE FROM public.org_notifications WHERE type = 'promotion';