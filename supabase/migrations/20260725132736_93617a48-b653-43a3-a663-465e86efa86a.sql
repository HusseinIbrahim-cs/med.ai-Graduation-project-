
-- Drop unused SECURITY DEFINER function exposed via PostgREST
DROP FUNCTION IF EXISTS public.get_email_for_patient_code(text);

-- Move has_role out of the API-exposed public schema so it is no longer
-- callable by anon/authenticated via PostgREST, while remaining usable
-- inside RLS policies.
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA private TO postgres, service_role;

CREATE OR REPLACE FUNCTION private.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

REVOKE ALL ON FUNCTION private.has_role(uuid, public.app_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) TO authenticated, service_role;

-- Recreate policies to use private.has_role
DROP POLICY IF EXISTS "Users read own profile" ON public.profiles;
CREATE POLICY "Users read own profile" ON public.profiles FOR SELECT
  USING (id = auth.uid() OR private.has_role(auth.uid(), 'admin') OR private.has_role(auth.uid(), 'doctor'));

DROP POLICY IF EXISTS "Admin manage profiles" ON public.profiles;
CREATE POLICY "Admin manage profiles" ON public.profiles FOR ALL
  USING (private.has_role(auth.uid(), 'admin'))
  WITH CHECK (private.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Users see own roles" ON public.user_roles;
CREATE POLICY "Users see own roles" ON public.user_roles FOR SELECT
  USING (user_id = auth.uid() OR private.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admin manage roles" ON public.user_roles;
CREATE POLICY "Admin manage roles" ON public.user_roles FOR ALL
  USING (private.has_role(auth.uid(), 'admin'))
  WITH CHECK (private.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Staff read all patients" ON public.patients;
CREATE POLICY "Staff read all patients" ON public.patients FOR SELECT
  USING (private.has_role(auth.uid(), 'admin') OR private.has_role(auth.uid(), 'doctor'));

DROP POLICY IF EXISTS "Staff insert patients" ON public.patients;
CREATE POLICY "Staff insert patients" ON public.patients FOR INSERT
  WITH CHECK (private.has_role(auth.uid(), 'admin') OR private.has_role(auth.uid(), 'doctor'));

DROP POLICY IF EXISTS "Staff update patients" ON public.patients;
CREATE POLICY "Staff update patients" ON public.patients FOR UPDATE
  USING (private.has_role(auth.uid(), 'admin') OR private.has_role(auth.uid(), 'doctor'));

DROP POLICY IF EXISTS "Admin delete patients" ON public.patients;
CREATE POLICY "Admin delete patients" ON public.patients FOR DELETE
  USING (private.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Staff read sessions" ON public.sessions;
CREATE POLICY "Staff read sessions" ON public.sessions FOR SELECT
  USING (private.has_role(auth.uid(), 'admin') OR private.has_role(auth.uid(), 'doctor'));

DROP POLICY IF EXISTS "Staff insert sessions" ON public.sessions;
CREATE POLICY "Staff insert sessions" ON public.sessions FOR INSERT
  WITH CHECK (private.has_role(auth.uid(), 'admin') OR private.has_role(auth.uid(), 'doctor'));

DROP POLICY IF EXISTS "Staff update sessions" ON public.sessions;
CREATE POLICY "Staff update sessions" ON public.sessions FOR UPDATE
  USING (private.has_role(auth.uid(), 'admin') OR private.has_role(auth.uid(), 'doctor'));

DROP POLICY IF EXISTS "Admin delete sessions" ON public.sessions;
CREATE POLICY "Admin delete sessions" ON public.sessions FOR DELETE
  USING (private.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Staff read xray images" ON storage.objects;
CREATE POLICY "Staff read xray images" ON storage.objects FOR SELECT
  USING (bucket_id = 'xray-images' AND (private.has_role(auth.uid(), 'admin') OR private.has_role(auth.uid(), 'doctor')));

DROP POLICY IF EXISTS "Staff upload xray images" ON storage.objects;
CREATE POLICY "Staff upload xray images" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'xray-images' AND (private.has_role(auth.uid(), 'admin') OR private.has_role(auth.uid(), 'doctor')));

DROP POLICY IF EXISTS "Staff delete xray images" ON storage.objects;
CREATE POLICY "Staff delete xray images" ON storage.objects FOR DELETE
  USING (bucket_id = 'xray-images' AND (private.has_role(auth.uid(), 'admin') OR private.has_role(auth.uid(), 'doctor')));

-- Finally drop the public has_role now that no policy references it
DROP FUNCTION IF EXISTS public.has_role(uuid, public.app_role);
