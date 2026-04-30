import React, { createContext, useContext } from 'react';
import { siteConfig } from '@/config/toolsConfig';
import type { ThemeName } from '@/lib/themes';

interface SiteContextValue {
  /** Webhook to send submissions to for the current scope (user-owned or default). */
  activeWebhookUrl: string;
  /** Username owning the current scope, if any. */
  ownerUsername?: string;
  /** Path prefix to prepend to in-app links (e.g. "/alice" or ""). */
  basePath: string;
  /** When set, overrides the stock tutorial video URL on every tool page. */
  overrideVideoUrl?: string | null;
  /** Site owner's chosen theme (only set on /:username/* routes). */
  siteTheme?: ThemeName;
}

const SiteContext = createContext<SiteContextValue>({
  activeWebhookUrl: siteConfig.webhookUrl,
  basePath: '',
});

export const SiteProvider: React.FC<{ value: SiteContextValue; children: React.ReactNode }> = ({ value, children }) => (
  <SiteContext.Provider value={value}>{children}</SiteContext.Provider>
);

export const useSite = () => useContext(SiteContext);
