
-- ENUMS
CREATE TYPE public.app_role AS ENUM ('admin', 'doctor', 'patient');
CREATE TYPE public.progress_status AS ENUM ('baseline_established', 'showing_improvement', 'no_improvement');

-- PROFILES
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL DEFAULT '',
  email TEXT,
  patient_code TEXT UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- USER ROLES
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- HAS ROLE
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- PATIENTS
CREATE TABLE public.patients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  age INT,
  gender TEXT,
  primary_concern TEXT,
  patient_code TEXT UNIQUE,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.patients TO authenticated;
GRANT ALL ON public.patients TO service_role;
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;

-- Add patient_id link on profiles (for patient-role users)
ALTER TABLE public.profiles ADD COLUMN patient_id UUID REFERENCES public.patients(id) ON DELETE SET NULL;

-- SESSIONS
CREATE TABLE public.sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  session_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  insurance_provider TEXT,
  progress_status public.progress_status,
  next_session_time TIMESTAMPTZ,
  doctor_notes TEXT,
  prescribed_medicine TEXT,
  summary TEXT,
  soap JSONB,
  doctor_transcript TEXT,
  patient_transcript TEXT,
  xray_image_path TEXT,
  xray_top_disease TEXT,
  xray_findings JSONB,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sessions TO authenticated;
GRANT ALL ON public.sessions TO service_role;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;

-- POLICIES: profiles
CREATE POLICY "Users read own profile" ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'doctor'));
CREATE POLICY "Admin manage profiles" ON public.profiles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- POLICIES: user_roles
CREATE POLICY "Users see own roles" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin manage roles" ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- POLICIES: patients
CREATE POLICY "Staff read all patients" ON public.patients FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'doctor'));
CREATE POLICY "Patient reads own record" ON public.patients FOR SELECT TO authenticated
  USING (id = (SELECT patient_id FROM public.profiles WHERE id = auth.uid()));
CREATE POLICY "Staff insert patients" ON public.patients FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'doctor'));
CREATE POLICY "Staff update patients" ON public.patients FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'doctor'));
CREATE POLICY "Admin delete patients" ON public.patients FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- POLICIES: sessions
CREATE POLICY "Staff read sessions" ON public.sessions FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'doctor'));
CREATE POLICY "Patient reads own sessions" ON public.sessions FOR SELECT TO authenticated
  USING (patient_id = (SELECT patient_id FROM public.profiles WHERE id = auth.uid()));
CREATE POLICY "Staff insert sessions" ON public.sessions FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'doctor'));
CREATE POLICY "Staff update sessions" ON public.sessions FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'doctor'));
CREATE POLICY "Admin delete sessions" ON public.sessions FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- RPC: resolve patient_code -> auth email (so patient login w/ code+PIN works)
CREATE OR REPLACE FUNCTION public.get_email_for_patient_code(_code TEXT)
RETURNS TEXT
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT email FROM public.profiles WHERE patient_code = _code LIMIT 1
$$;
GRANT EXECUTE ON FUNCTION public.get_email_for_patient_code(TEXT) TO anon, authenticated;

-- Trigger: auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''), NEW.email)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
