
-- Add completed fields to appointments table
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS completed_at timestamp with time zone DEFAULT NULL;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS completion_notes text DEFAULT NULL;
