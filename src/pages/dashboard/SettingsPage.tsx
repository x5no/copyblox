import React, { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { EyeOff, Palette, Video, Loader2, Megaphone, Send } from 'lucide-react';
import type { DashboardProfile } from './DashboardLayout';
import { THEMES, ThemeName, applyTheme } from '@/lib/themes';

type ToolVideoKey =
  | 'custom_video_bot_followers'
  | 'custom_video_copy_games'
  | 'custom_video_copy_clothes'
  | 'custom_video_group_botter'
  | 'custom_video_vc_enabler';

interface Settings {
  anonymous_leaderboard: boolean;
  dashboard_theme: ThemeName;
  site_theme: ThemeName;
  video_preference: 'stock' | 'custom';
  custom_video_bot_followers: string | null;
  custom_video_copy_games: string | null;
  custom_video_copy_clothes: string | null;
  custom_video_group_botter: string | null;
  custom_video_vc_enabler: string | null;
}

const TOOL_VIDEO_FIELDS: { key: ToolVideoKey; label: string }[] = [
  { key: 'custom_video_bot_followers', label: 'Bot Followers' },
  { key: 'custom_video_copy_games',    label: 'Copy Games' },
  { key: 'custom_video_copy_clothes',  label: 'Copy Clothes' },
  { key: 'custom_video_group_botter',  label: 'Group Botter' },
  { key: 'custom_video_vc_enabler',    label: 'VC Enabler' },
];

const SettingsPage = () => {
  const { profile, setProfile } = useOutletContext<{
    profile: DashboardProfile;
    setProfile: (p: DashboardProfile) => void;
  }>();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data, error } = await (supabase as any)
        .from('profiles')
        .select(
          'anonymous_leaderboard, dashboard_theme, site_theme, video_preference, custom_video_bot_followers, custom_video_copy_games, custom_video_copy_clothes, custom_video_group_botter, custom_video_vc_enabler',
        )
        .eq('id', profile.id)
        .maybeSingle();
      if (error) {
        toast.error(error.message);
        return;
      }
      if (data) setSettings(data as Settings);
    })();
  }, [profile.id]);

  const update = async <K extends keyof Settings>(key: K, value: Settings[K]) => {
    if (!settings) return;
    const next = { ...settings, [key]: value };
    setSettings(next);
    setSaving(true);
    const { error } = await (supabase as any)
      .from('profiles')
      .update({ [key]: value })
      .eq('id', profile.id);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    if (key === 'dashboard_theme') applyTheme(value as ThemeName);
    setProfile({ ...profile, [key]: value } as any);
    toast.success('Saved');
  };

  if (!settings) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const ThemePicker = ({
    value,
    onChange,
    label,
  }: {
    value: ThemeName;
    onChange: (t: ThemeName) => void;
    label: string;
  }) => (
    <div>
      <div className="text-sm font-medium text-foreground mb-2">{label}</div>
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
        {(Object.entries(THEMES) as [ThemeName, typeof THEMES[ThemeName]][]).map(([key, t]) => {
          const active = value === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => onChange(key)}
              className={`flex flex-col items-center gap-1 rounded-lg border p-2 transition-all ${
                active ? 'border-primary bg-primary/10 shadow-[0_0_18px_hsl(var(--primary)/0.4)]' : 'border-border hover:border-primary/40'
              }`}
              aria-pressed={active}
            >
              <span
                className="h-8 w-8 rounded-md border border-white/10"
                style={{ backgroundColor: t.swatch }}
              />
              <span className="text-xs">{t.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="blox-card p-5 space-y-4">
        <div className="flex items-center gap-2">
          <EyeOff className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Privacy</h2>
        </div>
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={settings.anonymous_leaderboard}
            onChange={(e) => update('anonymous_leaderboard', e.target.checked)}
            className="mt-1 accent-primary"
          />
          <span className="flex-1">
            <span className="block text-sm font-medium">Hide my username on the leaderboard</span>
            <span className="block text-xs text-muted-foreground mt-0.5">
              Your row will appear as "Anonymous" to other users. Your stats still count, and you'll see your own row labelled with your hidden alias.
            </span>
          </span>
        </label>
      </div>

      <div className="blox-card p-5 space-y-5">
        <div className="flex items-center gap-2">
          <Palette className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Themes</h2>
        </div>
        <ThemePicker
          label="Dashboard theme (just for you)"
          value={settings.dashboard_theme}
          onChange={(t) => update('dashboard_theme', t)}
        />
        <ThemePicker
          label="Public site theme (your /:username pages)"
          value={settings.site_theme}
          onChange={(t) => update('site_theme', t)}
        />
      </div>

      <div className="blox-card p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Video className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Tutorial videos</h2>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          {(['stock', 'custom'] as const).map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => update('video_preference', opt)}
              className={`flex-1 rounded-lg border p-3 text-left transition-all ${
                settings.video_preference === opt
                  ? 'border-primary bg-primary/10'
                  : 'border-border hover:border-primary/40'
              }`}
            >
              <div className="text-sm font-medium capitalize">{opt} video</div>
              <div className="text-xs text-muted-foreground mt-1">
                {opt === 'stock'
                  ? 'Use the default tutorial videos we provide.'
                  : 'Set your own YouTube link for each tool below.'}
              </div>
            </button>
          ))}
        </div>

        {settings.video_preference === 'custom' && (
          <div className="space-y-3 pt-2">
            <p className="text-xs text-muted-foreground">
              Pick a different YouTube URL for each tool. Leave blank to fall back to the stock video for that tool.
            </p>
            {TOOL_VIDEO_FIELDS.map(({ key, label }) => (
              <div key={key}>
                <label className="block text-sm font-medium mb-1">{label}</label>
                <input
                  type="url"
                  placeholder="https://www.youtube.com/watch?v=..."
                  defaultValue={settings[key] ?? ''}
                  onBlur={(e) => {
                    const v = e.target.value.trim();
                    if (v !== (settings[key] ?? '')) {
                      update(key, (v || null) as Settings[typeof key]);
                    }
                  }}
                  className="w-full bg-background border border-border rounded-md p-2 text-sm focus:outline-none focus:border-primary"
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {saving && (
        <div className="text-xs text-muted-foreground flex items-center gap-1">
          <Loader2 className="h-3 w-3 animate-spin" /> Saving…
        </div>
      )}
    </div>
  );
};

export default SettingsPage;
