-- Create role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'superviseur', 'agent');

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  initials TEXT NOT NULL DEFAULT '',
  color TEXT NOT NULL DEFAULT '#0d3d26',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Create user_roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  UNIQUE(user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function for role check
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

-- Function to get user role
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id UUID)
RETURNS app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.user_roles WHERE user_id = _user_id LIMIT 1
$$;

-- Profiles RLS
CREATE POLICY "Authenticated users can view all profiles"
  ON public.profiles FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- User roles RLS
CREATE POLICY "Authenticated users can view roles"
  ON public.user_roles FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage roles"
  ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Beneficiaires table
CREATE TABLE public.beneficiaires (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom TEXT NOT NULL,
  dossier TEXT NOT NULL UNIQUE,
  tel TEXT,
  quartier TEXT,
  montant INTEGER NOT NULL DEFAULT 0,
  pct INTEGER NOT NULL DEFAULT 0,
  statut TEXT NOT NULL DEFAULT 'Actif' CHECK (statut IN ('Actif', 'Retard', 'Défaut', 'Soldé')),
  score INTEGER NOT NULL DEFAULT 3,
  activite TEXT,
  groupe TEXT,
  agent_id UUID REFERENCES auth.users(id),
  agent_name TEXT,
  dob TEXT,
  adresse TEXT,
  inscription TEXT,
  credit_num TEXT,
  taux TEXT,
  paye INTEGER NOT NULL DEFAULT 0,
  total INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.beneficiaires ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view beneficiaires"
  ON public.beneficiaires FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins and supervisors can insert beneficiaires"
  ON public.beneficiaires FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'superviseur'));

CREATE POLICY "Admins and supervisors can update beneficiaires"
  ON public.beneficiaires FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'superviseur'));

CREATE POLICY "Admins can delete beneficiaires"
  ON public.beneficiaires FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Echeances table
CREATE TABLE public.echeances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  beneficiaire_id UUID NOT NULL REFERENCES public.beneficiaires(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  prevu INTEGER NOT NULL DEFAULT 0,
  paye INTEGER NOT NULL DEFAULT 0,
  retard INTEGER NOT NULL DEFAULT 0,
  statut TEXT NOT NULL DEFAULT 'À venir' CHECK (statut IN ('Payé', 'En cours', 'Retard', 'À venir', 'Impayé')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.echeances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view echeances"
  ON public.echeances FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins and supervisors can manage echeances"
  ON public.echeances FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'superviseur'));

-- Transactions table
CREATE TABLE public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  beneficiaire_id UUID REFERENCES public.beneficiaires(id) ON DELETE SET NULL,
  beneficiaire_nom TEXT,
  type TEXT NOT NULL CHECK (type IN ('Décaissement', 'Remboursement', 'Frais', 'Pénalité')),
  montant INTEGER NOT NULL,
  methode TEXT,
  reference TEXT,
  agent_id UUID REFERENCES auth.users(id),
  agent_name TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view transactions"
  ON public.transactions FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins and supervisors can insert transactions"
  ON public.transactions FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'superviseur'));

-- Notifications table
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  icon TEXT NOT NULL DEFAULT '🔔',
  text TEXT NOT NULL,
  time TEXT NOT NULL,
  read BOOLEAN NOT NULL DEFAULT false,
  user_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view notifications"
  ON public.notifications FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage notifications"
  ON public.notifications FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_beneficiaires_updated_at
  BEFORE UPDATE ON public.beneficiaires FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, name, initials, color)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
    UPPER(LEFT(COALESCE(NEW.raw_user_meta_data->>'name', NEW.email), 2)),
    '#0d3d26'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();