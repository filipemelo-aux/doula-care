
-- Add device_type to push_subscriptions for device tracking
ALTER TABLE public.push_subscriptions
ADD COLUMN IF NOT EXISTS device_type text DEFAULT 'unknown';
