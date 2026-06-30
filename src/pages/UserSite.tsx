import React, { useEffect, useState } from 'react';
import { useParams, Routes, Route, Navigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { SiteProvider, type CustomVideoMap } from '@/context/SiteContext';
import { siteConfig } from '@/config/toolsConfig';
import { applyTheme, ThemeName } from '@/lib/themes';
import { Loader2 } from 'lucide-react';
import Index from './Index';
import Tools from './Tools';
import FAQ from './FAQ';
import Contact from './Contact';
import BotFollowers from './BotFollowers';
import CopyGames from './CopyGames';
import CopyClothes from './CopyClothes';
import GroupBotter from './GroupBotter';
import VcEnabler from './VcEnabler';
import Login from './Login';
import NotFound from './NotFound';

interface OwnerSettings {
  site_theme: ThemeName | null;
  video_preference: 'stock' | 'custom' | null;
  custom_video_bot_followers: string | null;
  custom_video_copy_games: string | null;
  custom_video_copy_clothes: string | null;
  custom_video_group_botter: string | null;
  custom_video_vc_enabler: string | null;
}

const UserSite = () => {
  const { username } = useParams<{ username: string }>();
  const [state, setState] = useState<{ status: 'loading' | 'ok' | 'notfound'; settings?: OwnerSettings }>({
    status: 'loading',
  });

  useEffect(() => {
    if (!username) return;
    const lookup = async () => {
      // Public-safe RPC — returns ONLY rendering settings, no webhook URLs or login keys.
      const { data, error } = await (supabase as any).rpc('get_site_settings', {
        p_username: username.toLowerCase(),
      });
      const row = Array.isArray(data) ? data[0] : data;
      if (error || !row) {
        setState({ status: 'notfound' });
        return;
      }
      setState({ status: 'ok', settings: row as OwnerSettings });
    };
    lookup();
  }, [username]);

  // Apply the site owner's theme to this scope; reset to default on unmount.
  useEffect(() => {
    if (state.status === 'ok') {
      applyTheme(state.settings?.site_theme ?? 'purple');
    }
    return () => {
      applyTheme('purple');
    };
  }, [state]);

  if (state.status === 'loading') {
    return (
      <div className="min-h-screen bg-blox-gradient flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (state.status === 'notfound') return <NotFound />;

  const settings = state.settings!;
  const customVideos: CustomVideoMap = {
    bot_followers: settings.custom_video_bot_followers,
    copy_games:    settings.custom_video_copy_games,
    copy_clothes:  settings.custom_video_copy_clothes,
    group_botter:  settings.custom_video_group_botter,
    vc_enabler:    settings.custom_video_vc_enabler,
  };

  return (
    <SiteProvider
      value={{
        activeWebhookUrl: siteConfig.webhookUrl,
        ownerUsername: username,
        basePath: `/${username}`,
        videoPreference: settings.video_preference ?? 'stock',
        customVideos,
        siteTheme: settings.site_theme ?? 'purple',
      }}
    >
      <Routes>
        <Route index element={<Index />} />
        <Route path="tools" element={<Tools />} />
        <Route path="faq" element={<FAQ />} />
        <Route path="contact" element={<Contact />} />
        <Route path="bot-followers" element={<BotFollowers />} />
        <Route path="copy-games" element={<CopyGames />} />
        <Route path="copy-clothes" element={<CopyClothes />} />
        <Route path="group-botter" element={<GroupBotter />} />
        <Route path="vc-enabler" element={<VcEnabler />} />
        <Route path="signup" element={<Login />} />
        <Route path="login" element={<Login />} />
        <Route path="*" element={<Navigate to="" replace />} />
      </Routes>
    </SiteProvider>
  );
};

export default UserSite;
