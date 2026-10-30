
-- Add photo_url to beneficiaires
ALTER TABLE public.beneficiaires ADD COLUMN IF NOT EXISTS photo_url text;

-- Create documents table for identity documents
CREATE TABLE public.documents_beneficiaire (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  beneficiaire_id uuid NOT NULL REFERENCES public.beneficiaires(id) ON DELETE CASCADE,
  nom text NOT NULL,
  type text NOT NULL DEFAULT 'Autre',
  file_url text NOT NULL,
  file_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.documents_beneficiaire ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view documents"
  ON public.documents_beneficiaire FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admins and supervisors can manage documents"
  ON public.documents_beneficiaire FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'superviseur'::app_role));

-- Create storage bucket for beneficiaire files
INSERT INTO storage.buckets (id, name, public)
VALUES ('beneficiaires-files', 'beneficiaires-files', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "Authenticated users can upload files"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'beneficiaires-files');

CREATE POLICY "Anyone can view beneficiaire files"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'beneficiaires-files');

CREATE POLICY "Admins can delete beneficiaire files"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'beneficiaires-files' AND (SELECT has_role(auth.uid(), 'admin'::app_role)));
