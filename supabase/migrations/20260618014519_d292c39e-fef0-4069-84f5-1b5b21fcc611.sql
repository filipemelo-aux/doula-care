
-- 1) Contracts bucket: scope admin/moderator access to own organization
DROP POLICY IF EXISTS "Admins can manage contract files" ON storage.objects;

CREATE POLICY "Admins can manage contract files"
ON storage.objects
FOR ALL
TO authenticated
USING (
  bucket_id = 'contracts'
  AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'moderator'::app_role))
  AND EXISTS (
    SELECT 1 FROM public.clients c
    WHERE c.id::text = (storage.foldername(name))[1]
      AND c.organization_id = get_user_organization_id()
  )
)
WITH CHECK (
  bucket_id = 'contracts'
  AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'moderator'::app_role))
  AND EXISTS (
    SELECT 1 FROM public.clients c
    WHERE c.id::text = (storage.foldername(name))[1]
      AND c.organization_id = get_user_organization_id()
  )
);

-- 2) message-attachments: scope uploads to the uploader's own folder
DROP POLICY IF EXISTS "Authenticated users can upload attachments" ON storage.objects;

CREATE POLICY "Authenticated users can upload attachments"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'message-attachments'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- 3) org_access_log: restrict INSERT to user's own organization
DROP POLICY IF EXISTS "Users can insert own access log" ON public.org_access_log;

CREATE POLICY "Users can insert own access log"
ON public.org_access_log
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND organization_id = get_user_organization_id()
);
