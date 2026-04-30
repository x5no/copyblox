// Stock dashboard / site themes. Each entry maps to HSL CSS variables that
// override the defaults declared in src/index.css.
//
// Variables overridden:
//   --primary, --ring, --accent, --dashboard-glow, --gradient-site

export type ThemeName = 'yellow' | 'red' | 'blue' | 'purple' | 'green' | 'black';

export const THEMES: Record<ThemeName, {
  label: string;
  swatch: string;          // hex used in the picker
  primary: string;         // HSL triple "h s% l%"
  glowFrom: string;        // top-of-page radial color
  siteFrom: string;        // gradient start (HSL)
  siteTo: string;          // gradient end (HSL)
}> = {
  purple: {
    label: 'Purple',
    swatch: '#a855f7',
    primary: '271 91% 65%',
    glowFrom: '271 91% 65%',
    siteFrom: '0 0% 7%',
    siteTo: '276 58% 17%',
  },
  blue: {
    label: 'Blue',
    swatch: '#3b82f6',
    primary: '217 91% 60%',
    glowFrom: '217 91% 60%',
    siteFrom: '0 0% 7%',
    siteTo: '217 70% 18%',
  },
  green: {
    label: 'Green',
    swatch: '#22c55e',
    primary: '142 71% 45%',
    glowFrom: '142 71% 45%',
    siteFrom: '0 0% 7%',
    siteTo: '150 50% 15%',
  },
  red: {
    label: 'Red',
    swatch: '#ef4444',
    primary: '0 84% 60%',
    glowFrom: '0 84% 60%',
    siteFrom: '0 0% 7%',
    siteTo: '0 60% 18%',
  },
  yellow: {
    label: 'Yellow',
    swatch: '#eab308',
    primary: '45 93% 55%',
    glowFrom: '45 93% 55%',
    siteFrom: '0 0% 7%',
    siteTo: '40 60% 18%',
  },
  black: {
    label: 'Black',
    swatch: '#1f1f1f',
    primary: '0 0% 90%',
    glowFrom: '0 0% 60%',
    siteFrom: '0 0% 5%',
    siteTo: '0 0% 12%',
  },
};

export function applyTheme(theme: ThemeName | null | undefined) {
  const t = THEMES[(theme ?? 'purple') as ThemeName] ?? THEMES.purple;
  const root = document.documentElement;
  root.style.setProperty('--primary', t.primary);
  root.style.setProperty('--ring', t.primary);
  root.style.setProperty('--accent', t.primary);
  root.style.setProperty('--dashboard-glow', t.glowFrom);
  root.style.setProperty(
    '--gradient-site',
    `linear-gradient(135deg, hsl(${t.siteFrom}) 0%, hsl(${t.siteTo}) 100%)`,
  );
}
