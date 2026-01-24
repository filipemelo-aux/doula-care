-- Add column to track received amount for partial payments
ALTER TABLE public.transactions 
ADD COLUMN amount_received numeric DEFAULT 0;

-- Update existing transactions: if payment was made, set amount_received = amount
UPDATE public.transactions 
SET amount_received = amount 
WHERE type = 'receita';