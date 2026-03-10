ALTER TABLE public.push_subscriptions 
ADD COLUMN IF NOT EXISTS token_type text NOT NULL DEFAULT 'web';

COMMENT ON COLUMN public.push_subscriptions.token_type IS 'web = Web Push (VAPID), fcm = Firebase Cloud Messaging native token';