DROP TRIGGER IF EXISTS auto_update_payment_status ON public.payments;
DROP TRIGGER IF EXISTS sync_client_payment_status_trigger ON public.transactions;