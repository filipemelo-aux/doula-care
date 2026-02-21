
-- 1. Allow clients to delete their own notifications
CREATE POLICY "Clients can delete own notifications"
ON public.client_notifications
FOR DELETE
USING (EXISTS (
  SELECT 1 FROM clients c
  WHERE c.id = client_notifications.client_id AND c.user_id = auth.uid()
));

-- 2. Add rating_photos column to service_requests
ALTER TABLE public.service_requests
ADD COLUMN rating_photos text[] DEFAULT '{}';

-- 3. Create storage bucket for rating photos
INSERT INTO storage.buckets (id, name, public) VALUES ('rating-photos', 'rating-photos', true);

-- 4. Storage policies for rating photos
CREATE POLICY "Clients can upload rating photos"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'rating-photos' AND auth.uid() IS NOT NULL);

CREATE POLICY "Anyone can view rating photos"
ON storage.objects FOR SELECT
USING (bucket_id = 'rating-photos');

CREATE POLICY "Clients can delete own rating photos"
ON storage.objects FOR DELETE
USING (bucket_id = 'rating-photos' AND auth.uid() IS NOT NULL);
