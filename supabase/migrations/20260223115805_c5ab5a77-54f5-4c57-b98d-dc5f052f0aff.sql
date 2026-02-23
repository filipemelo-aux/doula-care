
-- Add columns to track which reminders were already sent
ALTER TABLE public.appointments 
ADD COLUMN IF NOT EXISTS reminder_24h_sent boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS reminder_1h_sent boolean NOT NULL DEFAULT false;
