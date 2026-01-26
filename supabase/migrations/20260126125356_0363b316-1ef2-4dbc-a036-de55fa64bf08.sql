-- Add labor tracking to clients table
ALTER TABLE public.clients 
ADD COLUMN labor_started_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Create contractions table
CREATE TABLE public.contractions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  ended_at TIMESTAMP WITH TIME ZONE,
  duration_seconds INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.contractions ENABLE ROW LEVEL SECURITY;

-- Clients can manage their own contractions
CREATE POLICY "Clients can view own contractions" 
ON public.contractions 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM clients c 
    WHERE c.id = contractions.client_id 
    AND c.user_id = auth.uid()
  ) OR has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Clients can insert own contractions" 
ON public.contractions 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM clients c 
    WHERE c.id = contractions.client_id 
    AND c.user_id = auth.uid()
  )
);

CREATE POLICY "Clients can update own contractions" 
ON public.contractions 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM clients c 
    WHERE c.id = contractions.client_id 
    AND c.user_id = auth.uid()
  )
);

CREATE POLICY "Clients can delete own contractions" 
ON public.contractions 
FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM clients c 
    WHERE c.id = contractions.client_id 
    AND c.user_id = auth.uid()
  )
);

-- Admins can manage all contractions
CREATE POLICY "Admins can manage all contractions" 
ON public.contractions 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Create index for faster queries
CREATE INDEX idx_contractions_client_id ON public.contractions(client_id);
CREATE INDEX idx_contractions_started_at ON public.contractions(started_at DESC);