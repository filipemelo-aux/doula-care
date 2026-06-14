REVOKE ALL ON FUNCTION public.guard_payment_history() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.guard_transaction_payment_history() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_payment_rollups() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.recompute_client_payment_status(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_payment_status() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_client_payment_status() FROM PUBLIC, anon, authenticated;