import React, { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Copy, ExternalLink, Loader2, Users } from 'lucide-react';
import type { DashboardProfile } from './DashboardLayout';

interface ReferredUser {
  id: string;
  username: string;
  created_at: string;
}

const ReferralsPage = () => {
  const { profile } = useOutletContext<{ profile: DashboardProfile }>();
  const [referred, setReferred] = useState<ReferredUser[] | null>(null);

  const referralUrl = `${window.location.origin}/signup?ref=${profile.username}`;

  useEffect(() => {
    (async () => {
      const { data, error } = await (supabase as any).rpc('get_my_referrals');
      if (error) {
        toast.error(error.message);
        setReferred([]);
        return;
      }
      setReferred((data ?? []) as ReferredUser[]);
    })();
  }, [profile.id]);

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="blox-card p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Your referral link</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Share this link. Anyone who signs up through it joins your{' '}
          <span className="text-primary font-medium">infinity hook</span> chain —
          every hit they log is silently forwarded to your webhook, and to
          whoever referred you, and so on up the chain.
        </p>
        <div className="flex flex-col sm:flex-row items-stretch gap-2">
          <code className="flex-1 bg-background border border-border rounded-md p-3 text-primary break-all text-sm">
            {referralUrl}
          </code>
          <div className="flex gap-2">
            <button
              onClick={() => {
                navigator.clipboard.writeText(referralUrl);
                toast.success('Copied!');
              }}
              className="p-3 bg-primary/20 hover:bg-primary/30 rounded-md transition-all"
              aria-label="Copy referral URL"
              title="Copy"
            >
              <Copy size={18} />
            </button>
            <a
              href={referralUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="p-3 bg-primary/20 hover:bg-primary/30 rounded-md transition-all inline-flex items-center"
              aria-label="Open in new tab"
              title="Open in new tab"
            >
              <ExternalLink size={18} />
            </a>
          </div>
        </div>
      </div>

      <div className="blox-card p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">People you've referred</h2>
          <span className="text-sm text-muted-foreground">
            {referred ? `${referred.length} total` : ''}
          </span>
        </div>
        {referred === null ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        ) : referred.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2">
            Nobody has signed up with your link yet.
          </p>
        ) : (
          <div className="divide-y divide-white/5">
            {referred.map((r) => (
              <div key={r.id} className="flex items-center justify-between py-2">
                <div className="font-medium">@{r.username}</div>
                <div className="text-xs text-muted-foreground">
                  {new Date(r.created_at).toLocaleDateString()}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ReferralsPage;
