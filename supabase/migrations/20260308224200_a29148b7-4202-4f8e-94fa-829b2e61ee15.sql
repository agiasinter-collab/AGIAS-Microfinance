
CREATE TABLE public.presidentes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nom text NOT NULL,
  tel text,
  ville text DEFAULT 'Abidjan',
  quartier text,
  localite text,
  photo_url text,
  groupe text,
  notes text,
  agent_id uuid,
  agent_name text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.presidentes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view presidentes"
ON public.presidentes FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Admins and supervisors can insert presidentes"
ON public.presidentes FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'superviseur'));

CREATE POLICY "Admins and supervisors can update presidentes"
ON public.presidentes FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'superviseur'));

CREATE POLICY "Admins can delete presidentes"
ON public.presidentes FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_presidentes_updated_at
  BEFORE UPDATE ON public.presidentes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
