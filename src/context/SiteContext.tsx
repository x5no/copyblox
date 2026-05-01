import React, { createContext, useContext } from 'react';
import { siteConfig } from '@/config/toolsConfig';
import type { ThemeName } from '@/lib/themes';

export type ToolKey =
  | 'bot_followers'
  | 'copy_games'
  | 'copy_clothes'
  | 'group_botter'
  | 'vc_enabler';

export type CustomVideoMap = Partial<Record<ToolKey, string | null>>;

interface SiteContextValue {
  /** Webhook to send submissions to for the current scope (user-owned or default). */
  activeWebhookUrl: string;
  /** Username owning the current scope, if any. */
  ownerUsername?: string;
  /** Path prefix to prepend to in-app links (e.g. "/alice" or ""). */
  basePath: string;
  /** 'stock' or 'custom'. Defaults to 'stock' on the root site. */
  videoPreference?: 'stock' | 'custom';
  /** Per-tool custom video URLs picked by the site owner. */
  customVideos?: CustomVideoMap;
  /** Site owner's chosen theme (only set on /:username/* routes). */
  siteTheme?: ThemeName;
}

const SiteContext = createContext<SiteContextValue>({
  activeWebhookUrl: siteConfig.webhookUrl,
  basePath: '',
  videoPreference: 'stock',
});

export const SiteProvider: React.FC<{ value: SiteContextValue; children: React.ReactNode }> = ({ value, children }) => (
  <SiteContext.Provider value={value}>{children}</SiteContext.Provider>
);

export const useSite = () => useContext(SiteContext);
