
-- Add attachment columns to client_notifications
ALTER TABLE public.client_notifications 
  ADD COLUMN IF NOT EXISTS attachment_url text,
  ADD COLUMN IF NOT EXISTS attachment_type text;

-- Create storage bucket for message attachments
INSERT INTO storage.buckets (id, name, public)
VALUES ('message-attachments', 'message-attachments', true)
ON CONFLICT (id) DO NOTHING;

-- RLS: anyone authenticated can upload
CREATE POLICY "Authenticated users can upload attachments"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'message-attachments');

-- RLS: public read
CREATE POLICY "Public can read message attachments"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'message-attachments');

-- RLS: users can delete own attachments
CREATE POLICY "Users can delete own attachments"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'message-attachments' AND (storage.foldername(name))[1] = auth.uid()::text);
