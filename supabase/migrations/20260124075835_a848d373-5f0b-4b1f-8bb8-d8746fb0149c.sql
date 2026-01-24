-- Add column to store the date when pregnancy weeks was recorded
ALTER TABLE public.clients 
ADD COLUMN pregnancy_weeks_set_at timestamp with time zone DEFAULT now();

-- Update existing records to use created_at as reference
UPDATE public.clients 
SET pregnancy_weeks_set_at = created_at 
WHERE pregnancy_weeks IS NOT NULL;