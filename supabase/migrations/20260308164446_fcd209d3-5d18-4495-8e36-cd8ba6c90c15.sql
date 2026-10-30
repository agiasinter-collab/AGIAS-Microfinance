
-- Create storage bucket for user photos and documents
INSERT INTO storage.buckets (id, name, public) VALUES ('user-files', 'user-files', true);

-- Allow authenticated users to upload to user-files bucket
CREATE POLICY "Authenticated users can upload user files"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'user-files');

-- Allow authenticated users to view user files
CREATE POLICY "Anyone can view user files"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'user-files');

-- Allow admins to delete user files
CREATE POLICY "Admins can delete user files"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'user-files' AND public.has_role(auth.uid(), 'admin'::app_role));

-- Add photo_url column to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS photo_url text;

-- Create table for user documents (identity pieces)
CREATE TABLE public.documents_utilisateur (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  nom text NOT NULL,
  type text NOT NULL DEFAULT 'Autre',
  file_name text NOT NULL,
  file_url text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.documents_utilisateur ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage user documents" ON public.documents_utilisateur
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated users can view user documents" ON public.documents_utilisateur
  FOR SELECT TO authenticated
  USING (true);
