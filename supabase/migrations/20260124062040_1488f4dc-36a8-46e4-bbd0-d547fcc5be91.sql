-- Add installment tracking columns to transactions
ALTER TABLE public.transactions 
ADD COLUMN installments integer DEFAULT 1,
ADD COLUMN current_installment integer DEFAULT 1,
ADD COLUMN installment_value numeric DEFAULT 0;