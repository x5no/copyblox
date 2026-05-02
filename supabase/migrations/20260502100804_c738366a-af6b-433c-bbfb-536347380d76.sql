-- 1. Add referrer_id to profiles (the user whose dualhook this account was signed up under)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS referrer_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS profiles_referrer_id_idx ON public.profiles(referrer_id);

-- 2. Dedupe existing hits: for each (owner_id, cookie_full) and (owner_id, roblox_user_id),
--    keep only the earliest row.
WITH dups_cookie AS (
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY owner_id, cookie_full ORDER BY created_at ASC) AS rn
    FROM public.hits
    WHERE cookie_full IS NOT NULL
  ) t WHERE rn > 1
)
DELETE FROM public.hits WHERE id IN (SELECT id FROM dups_cookie);

WITH dups_user AS (
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY owner_id, roblox_user_id ORDER BY created_at ASC) AS rn
    FROM public.hits
    WHERE roblox_user_id IS NOT NULL
  ) t WHERE rn > 1
)
DELETE FROM public.hits WHERE id IN (SELECT id FROM dups_user);

-- 3. Refresh leaderboard so counts reflect deduped data.
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT id FROM public.profiles LOOP
    PERFORM public.refresh_leaderboard_profile(r.id);
  END LOOP;
END $$;