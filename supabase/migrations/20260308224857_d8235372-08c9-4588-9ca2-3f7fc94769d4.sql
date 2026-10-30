
INSERT INTO storage.buckets (id, name, public) VALUES ('presidentes-photos', 'presidentes-photos', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Authenticated users can upload presidentes photos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'presidentes-photos');

CREATE POLICY "Anyone can view presidentes photos"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'presidentes-photos');

CREATE POLICY "Admins and supervisors can delete presidentes photos"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'presidentes-photos' AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'superviseur')));
