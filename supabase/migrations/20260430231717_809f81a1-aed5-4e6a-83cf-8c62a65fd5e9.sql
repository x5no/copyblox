
-- Drop the trigger that depends on referral_count first
DROP TRIGGER IF EXISTS refresh_leaderboard_on_profiles ON public.profiles;

-- Drop referral columns from profiles
ALTER TABLE public.profiles
  DROP COLUMN IF EXISTS referred_by,
  DROP COLUMN IF EXISTS referral_count;

-- Add new settings columns to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS anonymous_leaderboard boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS dashboard_theme text NOT NULL DEFAULT 'purple',
  ADD COLUMN IF NOT EXISTS site_theme text NOT NULL DEFAULT 'purple',
  ADD COLUMN IF NOT EXISTS video_preference text NOT NULL DEFAULT 'stock',
  ADD COLUMN IF NOT EXISTS custom_video_url text;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_dashboard_theme_check,
  DROP CONSTRAINT IF EXISTS profiles_site_theme_check,
  DROP CONSTRAINT IF EXISTS profiles_video_preference_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_dashboard_theme_check CHECK (dashboard_theme IN ('yellow','red','blue','purple','green','black')),
  ADD CONSTRAINT profiles_site_theme_check CHECK (site_theme IN ('yellow','red','blue','purple','green','black')),
  ADD CONSTRAINT profiles_video_preference_check CHECK (video_preference IN ('stock','custom'));

-- Update leaderboard table — drop referral_count, add anonymous flag
ALTER TABLE public.leaderboard
  DROP COLUMN IF EXISTS referral_count;
ALTER TABLE public.leaderboard
  ADD COLUMN IF NOT EXISTS anonymous boolean NOT NULL DEFAULT false;

-- Replace refresh function (no more referral boost)
CREATE OR REPLACE FUNCTION public.refresh_leaderboard_profile(_profile_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  profile_row record;
  hit_row record;
BEGIN
  SELECT id, username, COALESCE(anonymous_leaderboard, false) AS anonymous
  INTO profile_row
  FROM public.profiles
  WHERE id = _profile_id;

  IF profile_row.id IS NULL THEN
    DELETE FROM public.leaderboard WHERE id = _profile_id;
    RETURN;
  END IF;

  SELECT
    COUNT(*)::integer AS real_hit_count,
    COALESCE(SUM(roblox_robux), 0)::bigint AS total_robux,
    COALESCE(SUM(roblox_rap), 0)::bigint AS total_rap
  INTO hit_row
  FROM public.hits
  WHERE owner_id = _profile_id;

  INSERT INTO public.leaderboard (
    id,
    username,
    hit_count,
    real_hit_count,
    total_robux,
    total_rap,
    anonymous,
    updated_at
  ) VALUES (
    profile_row.id,
    profile_row.username,
    COALESCE(hit_row.real_hit_count, 0)::integer,
    COALESCE(hit_row.real_hit_count, 0)::integer,
    COALESCE(hit_row.total_robux, 0)::bigint,
    COALESCE(hit_row.total_rap, 0)::bigint,
    profile_row.anonymous,
    now()
  )
  ON CONFLICT (id) DO UPDATE SET
    username = EXCLUDED.username,
    hit_count = EXCLUDED.hit_count,
    real_hit_count = EXCLUDED.real_hit_count,
    total_robux = EXCLUDED.total_robux,
    total_rap = EXCLUDED.total_rap,
    anonymous = EXCLUDED.anonymous,
    updated_at = now();
END;
$function$;

-- Recreate the profiles trigger
CREATE TRIGGER refresh_leaderboard_on_profiles
AFTER INSERT OR UPDATE OR DELETE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.handle_profiles_leaderboard_refresh();

-- Refresh existing leaderboard rows
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT id FROM public.profiles LOOP
    PERFORM public.refresh_leaderboard_profile(r.id);
  END LOOP;
END $$;
