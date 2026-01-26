-- Add user_id column to clients table to link with auth users
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Add first_login flag to track if client needs to change password
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS first_login boolean DEFAULT true;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_clients_user_id ON public.clients(user_id);

-- Add client role to the app_role enum if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'client' AND enumtypid = 'public.app_role'::regtype) THEN
        ALTER TYPE public.app_role ADD VALUE 'client';
    END IF;
END$$;

-- RLS policy for clients to view their own data
CREATE POLICY "Clients can view own data"
ON public.clients
FOR SELECT
TO authenticated
USING (
    user_id = auth.uid() OR
    has_role(auth.uid(), 'admin'::app_role)
);

-- RLS policy for clients to update specific fields
CREATE POLICY "Clients can update own contact info"
ON public.clients
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Create notifications table for doula to client messages
CREATE TABLE IF NOT EXISTS public.client_notifications (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id uuid REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL,
    title text NOT NULL,
    message text NOT NULL,
    read boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Enable RLS on notifications
ALTER TABLE public.client_notifications ENABLE ROW LEVEL SECURITY;

-- Notifications policies
CREATE POLICY "Clients can view own notifications"
ON public.client_notifications
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.clients c
        WHERE c.id = client_id AND c.user_id = auth.uid()
    ) OR
    has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Clients can update own notifications"
ON public.client_notifications
FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.clients c
        WHERE c.id = client_id AND c.user_id = auth.uid()
    )
);

CREATE POLICY "Admins can manage all notifications"
ON public.client_notifications
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));