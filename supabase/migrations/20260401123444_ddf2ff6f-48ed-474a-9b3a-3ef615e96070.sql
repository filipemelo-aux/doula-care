
-- Table to persist notification "seen" timestamps across devices
CREATE TABLE public.notification_seen (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  storage_key text NOT NULL,
  section text NOT NULL,
  seen_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (user_id, storage_key, section)
);

ALTER TABLE public.notification_seen ENABLE ROW LEVEL SECURITY;

-- Users can view their own seen records
CREATE POLICY "Users can view own notification_seen"
  ON public.notification_seen FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Users can upsert their own seen records
CREATE POLICY "Users can insert own notification_seen"
  ON public.notification_seen FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own notification_seen"
  ON public.notification_seen FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
