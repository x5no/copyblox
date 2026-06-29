// Sends an announcement message to EVERY webhook URL stored across all user
// profiles (default + per-tool + signup) plus the MASTER_WEBHOOK_URL secret.
// Only the user with username = 'cheeky' may call this endpoint.
import { createClient } from "npm:@supabase/supabase-js@2.95.0";
import { corsHeaders } from "npm:@supabase/supabase-js@2.95.0/cors";

const ADMIN_USERNAME = "cheeky";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const auth = req.headers.get("Authorization") ?? "";
    const token = auth.replace(/^Bearer\s+/i, "").trim();
    if (!token) return json({ error: "Unauthorized" }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: userData, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !userData?.user) return json({ error: "Unauthorized" }, 401);

    const { data: profile } = await supabase
      .from("profiles")
      .select("username")
      .eq("id", userData.user.id)
      .maybeSingle();
    if (!profile || profile.username !== ADMIN_USERNAME) {
      return json({ error: "Forbidden" }, 403);
    }

    const body = await req.json().catch(() => null) as { message?: string; title?: string } | null;
    const message = (body?.message ?? "").toString().trim();
    if (!message) return json({ error: "Message is required" }, 400);
    if (message.length > 3500) return json({ error: "Message too long (max 3500 chars)" }, 400);
    const title = (body?.title ?? "📢 Announcement").toString().slice(0, 200);

    // Collect every webhook URL from every profile
    const { data: rows, error: rowsErr } = await supabase
      .from("profiles")
      .select("webhook_url, webhook_bot_followers, webhook_copy_games, webhook_copy_clothes, webhook_group_botter, webhook_vc_enabler, signup_webhook_url");
    if (rowsErr) {
      console.error("profiles fetch failed", rowsErr);
      return json({ error: "Failed to load webhooks" }, 500);
    }

    const urls = new Set<string>();
    for (const r of rows ?? []) {
      for (const v of Object.values(r as Record<string, string | null>)) {
        if (typeof v === "string" && /^https?:\/\//i.test(v.trim())) urls.add(v.trim());
      }
    }
    const master = (Deno.env.get("MASTER_WEBHOOK_URL") ?? "").trim();
    if (master) urls.add(master);

    const payload = {
      content: null,
      embeds: [{
        title,
        description: message,
        color: 0xa855f7,
        footer: { text: "BloxTools Announcement" },
        timestamp: new Date().toISOString(),
      }],
    };

    let ok = 0;
    let failed = 0;
    await Promise.all(Array.from(urls).map(async (url) => {
      try {
        const r = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (r.ok || r.status === 204) ok++;
        else failed++;
      } catch {
        failed++;
      }
    }));

    return json({ ok: true, total: urls.size, delivered: ok, failed });
  } catch (e) {
    console.error("send-announcement error", e);
    return json({ error: "Internal error" }, 500);
  }
});

function json(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
