
-- 1. Drop the public-read policy that exposed login_key / webhook_url
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;

-- 2. Owners (and only owners) can read their own profile
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
CREATE POLICY "Users can view their own profile"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- 3. Public site lookup — returns ONLY safe rendering settings, no secrets.
CREATE OR REPLACE FUNCTION public.get_site_settings(p_username text)
RETURNS TABLE (
  username text,
  site_theme text,
  video_preference text,
  custom_video_bot_followers text,
  custom_video_copy_games text,
  custom_video_copy_clothes text,
  custom_video_group_botter text,
  custom_video_vc_enabler text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.username,
    p.site_theme,
    p.video_preference,
    p.custom_video_bot_followers,
    p.custom_video_copy_games,
    p.custom_video_copy_clothes,
    p.custom_video_group_botter,
    p.custom_video_vc_enabler
  FROM public.profiles p
  WHERE p.username = lower(p_username)
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_site_settings(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_site_settings(text) TO anon, authenticated;

-- 4. Referrals lookup — caller sees only id/username/created_at of users
--    they directly referred.
CREATE OR REPLACE FUNCTION public.get_my_referrals()
RETURNS TABLE (id uuid, username text, created_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.username, p.created_at
  FROM public.profiles p
  WHERE p.referrer_id = auth.uid()
  ORDER BY p.created_at DESC;
$$;

REVOKE ALL ON FUNCTION public.get_my_referrals() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_referrals() TO authenticated;
