CREATE TRIGGER trg_restrict_client_update
  BEFORE UPDATE ON public.clients
  FOR EACH ROW
  EXECUTE FUNCTION public.restrict_client_update_fields();