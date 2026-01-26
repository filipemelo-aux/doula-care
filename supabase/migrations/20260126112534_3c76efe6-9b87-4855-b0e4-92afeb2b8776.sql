-- Create pregnancy diary table
CREATE TABLE public.pregnancy_diary (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  emotion TEXT,
  symptoms TEXT[],
  observations TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.pregnancy_diary ENABLE ROW LEVEL SECURITY;

-- Clients can view their own diary entries
CREATE POLICY "Clients can view own diary entries"
ON public.pregnancy_diary
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM clients c
    WHERE c.id = pregnancy_diary.client_id
    AND c.user_id = auth.uid()
  )
  OR has_role(auth.uid(), 'admin'::app_role)
);

-- Clients can create their own diary entries
CREATE POLICY "Clients can create own diary entries"
ON public.pregnancy_diary
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM clients c
    WHERE c.id = pregnancy_diary.client_id
    AND c.user_id = auth.uid()
  )
);

-- Clients can update their own diary entries
CREATE POLICY "Clients can update own diary entries"
ON public.pregnancy_diary
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM clients c
    WHERE c.id = pregnancy_diary.client_id
    AND c.user_id = auth.uid()
  )
);

-- Clients can delete their own diary entries
CREATE POLICY "Clients can delete own diary entries"
ON public.pregnancy_diary
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM clients c
    WHERE c.id = pregnancy_diary.client_id
    AND c.user_id = auth.uid()
  )
);

-- Admins can manage all diary entries
CREATE POLICY "Admins can manage all diary entries"
ON public.pregnancy_diary
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Create trigger for updated_at
CREATE TRIGGER update_pregnancy_diary_updated_at
BEFORE UPDATE ON public.pregnancy_diary
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();