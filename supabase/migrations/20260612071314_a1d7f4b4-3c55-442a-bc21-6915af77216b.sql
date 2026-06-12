
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS phone_number text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone_number text;
CREATE UNIQUE INDEX IF NOT EXISTS patients_phone_number_key ON public.patients (phone_number) WHERE phone_number IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS profiles_phone_number_key ON public.profiles (phone_number) WHERE phone_number IS NOT NULL;

-- Seed admin phone number (so the admin can sign in via the new phone-based staff login)
UPDATE public.profiles SET phone_number = 'admin'
WHERE email = 'admin@med.ai.com' AND phone_number IS NULL;
