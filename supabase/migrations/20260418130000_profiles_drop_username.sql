-- Username removed from product; identity uses email only.
DROP INDEX IF EXISTS public.profiles_username_lower_unique;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS username;
