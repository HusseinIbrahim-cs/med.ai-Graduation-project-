
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS pin text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS username text;
CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_unique ON public.profiles (lower(username)) WHERE username IS NOT NULL;
UPDATE public.profiles SET username = 'admin' WHERE email = 'admin@med.ai.com' AND username IS NULL;
