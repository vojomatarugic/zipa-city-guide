-- Optional public handle; stored lowercase by app (see Edge Function PATCH /users/profile).
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS username text;

-- Case-insensitive uniqueness for non-null usernames (multiple NULLs allowed).
CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_lower_unique
  ON public.profiles (lower(username))
  WHERE username IS NOT NULL;
