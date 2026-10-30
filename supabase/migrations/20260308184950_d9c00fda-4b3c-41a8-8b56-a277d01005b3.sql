CREATE POLICY "Authenticated users can upload beneficiaires files"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'beneficiaires-files');

CREATE POLICY "Authenticated users can update beneficiaires files"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'beneficiaires-files');

CREATE POLICY "Public can read beneficiaires files"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'beneficiaires-files');