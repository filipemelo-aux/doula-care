-- Add birth information fields to clients table
ALTER TABLE public.clients
ADD COLUMN IF NOT EXISTS birth_occurred BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS birth_date DATE,
ADD COLUMN IF NOT EXISTS birth_time TIME,
ADD COLUMN IF NOT EXISTS birth_weight DECIMAL(5,3),
ADD COLUMN IF NOT EXISTS birth_height DECIMAL(5,2);