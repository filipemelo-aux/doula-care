DELETE FROM public.service_records WHERE client_id IS NULL;
ALTER TABLE public.service_records DROP CONSTRAINT service_records_client_id_fkey;
ALTER TABLE public.service_records ADD CONSTRAINT service_records_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE;