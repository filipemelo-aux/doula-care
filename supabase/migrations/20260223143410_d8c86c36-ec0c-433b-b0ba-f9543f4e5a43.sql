
-- Add branding columns to organizations
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS primary_color text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS secondary_color text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS logo_url text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS nome_exibicao text DEFAULT NULL;

-- Create storage bucket for org logos
INSERT INTO storage.buckets (id, name, public)
VALUES ('org-logos', 'org-logos', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for org-logos bucket
CREATE POLICY "Admins can upload org logos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'org-logos'
  AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator'))
);

CREATE POLICY "Admins can update org logos"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'org-logos'
  AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator'))
);

CREATE POLICY "Admins can delete org logos"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'org-logos'
  AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator'))
);

CREATE POLICY "Anyone can view org logos"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'org-logos');
