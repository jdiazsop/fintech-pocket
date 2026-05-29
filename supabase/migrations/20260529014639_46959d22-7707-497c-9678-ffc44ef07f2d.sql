-- Add UPDATE policy for operation-evidences storage bucket
CREATE POLICY "Users update own evidence files"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'operation-evidences' AND auth.uid()::text = (storage.foldername(name))[1])
WITH CHECK (bucket_id = 'operation-evidences' AND auth.uid()::text = (storage.foldername(name))[1]);