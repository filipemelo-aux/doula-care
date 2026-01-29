-- Create service_requests table to track service request workflow
CREATE TABLE public.service_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  service_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'budget_sent', 'accepted', 'rejected')),
  budget_value NUMERIC NULL,
  budget_sent_at TIMESTAMP WITH TIME ZONE NULL,
  responded_at TIMESTAMP WITH TIME ZONE NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.service_requests ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Admins can manage all service requests"
ON public.service_requests
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Clients can view own service requests"
ON public.service_requests
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM clients c
  WHERE c.id = service_requests.client_id AND c.user_id = auth.uid()
));

CREATE POLICY "Clients can insert own service requests"
ON public.service_requests
FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM clients c
  WHERE c.id = service_requests.client_id AND c.user_id = auth.uid()
));

CREATE POLICY "Clients can update own service requests"
ON public.service_requests
FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM clients c
  WHERE c.id = service_requests.client_id AND c.user_id = auth.uid()
));

-- Trigger for updated_at
CREATE TRIGGER update_service_requests_updated_at
BEFORE UPDATE ON public.service_requests
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.service_requests;