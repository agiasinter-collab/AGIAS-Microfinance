
-- Table pour stocker les rapports générés
CREATE TABLE public.generated_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  period text NOT NULL,
  generated_by text NOT NULL,
  generated_by_id uuid NOT NULL,
  report_date timestamp with time zone NOT NULL DEFAULT now(),
  format text NOT NULL DEFAULT 'PDF',
  file_url text,
  file_name text,
  report_type text NOT NULL,
  data jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.generated_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view reports"
  ON public.generated_reports FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admins and supervisors can insert reports"
  ON public.generated_reports FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'superviseur'));

CREATE POLICY "Admins can delete reports"
  ON public.generated_reports FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'));

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.generated_reports;
