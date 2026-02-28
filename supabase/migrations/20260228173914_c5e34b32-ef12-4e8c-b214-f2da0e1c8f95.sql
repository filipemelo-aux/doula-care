-- Add file_url column to client_contracts
ALTER TABLE public.client_contracts ADD COLUMN file_url text;

-- Create storage bucket for contracts
INSERT INTO storage.buckets (id, name, public) VALUES ('contracts', 'contracts', false);

-- RLS: Admins can upload/manage contract files
CREATE POLICY "Admins can manage contract files"
ON storage.objects FOR ALL
USING (
  bucket_id = 'contracts'
  AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'moderator'))
)
WITH CHECK (
  bucket_id = 'contracts'
  AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'moderator'))
);

-- RLS: Clients can view their own contract files
CREATE POLICY "Clients can view own contract files"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'contracts'
  AND EXISTS (
    SELECT 1 FROM clients c
    WHERE c.user_id = auth.uid()
    AND (storage.foldername(name))[1] = c.id::text
  )
);

-- Super admins full access
CREATE POLICY "Super admins can manage all contract files"
ON storage.objects FOR ALL
USING (bucket_id = 'contracts' AND is_super_admin())
WITH CHECK (bucket_id = 'contracts' AND is_super_admin());