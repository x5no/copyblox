import React, { useEffect, useState } from 'react';
import { useParams, Routes, Route, Navigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { SiteProvider } from '@/context/SiteContext';
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
import NotFound from './NotFound';

interface OwnerSettings {
  webhook_url: string | null;
  site_theme: ThemeName | null;
  video_preference: 'stock' | 'custom' | null;
  custom_video_url: string | null;
}

const UserSite = () => {
  const { username } = useParams<{ username: string }>();
  const [state, setState] = useState<{ status: 'loading' | 'ok' | 'notfound'; settings?: OwnerSettings }>({
    status: 'loading',
  });

  useEffect(() => {
    if (!username) return;
    const lookup = async () => {
      const { data, error } = await (supabase as any)
        .from('profiles')
        .select('webhook_url, site_theme, video_preference, custom_video_url')
        .eq('username', username.toLowerCase())
        .maybeSingle();
      if (error || !data) {
        setState({ status: 'notfound' });
        return;
      }
      setState({ status: 'ok', settings: data as OwnerSettings });
    };
    lookup();
  }, [username]);

  // Apply the site owner's theme to this scope; reset to default on unmount.
  useEffect(() => {
    if (state.status === 'ok') {
      applyTheme(state.settings?.site_theme ?? 'purple');
    }
    return () => {
      // restore default purple when leaving a user site
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
  const overrideVideoUrl =
    settings.video_preference === 'custom' && settings.custom_video_url
      ? settings.custom_video_url
      : null;

  return (
    <SiteProvider
      value={{
        activeWebhookUrl: settings.webhook_url || siteConfig.webhookUrl,
        ownerUsername: username,
        basePath: `/${username}`,
        overrideVideoUrl,
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
        <Route path="*" element={<Navigate to="" replace />} />
      </Routes>
    </SiteProvider>
  );
};

export default UserSite;
