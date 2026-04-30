import React, { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Copy, Gift, Link as LinkIcon, Users } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { getReferralTier, REFERRAL_TIERS } from '@/config/toolsConfig';
import type { DashboardProfile } from './DashboardLayout';

const ReferralsPage = () => {
  const { profile } = useOutletContext<{ profile: DashboardProfile }>();
  const [referralCount, setReferralCount] = useState(profile.referral_count ?? 0);
  const referralLink = `${window.location.origin}/signup?ref=${profile.username}`;
  const tier = getReferralTier(referralCount);
  const nextNeeded = tier.next ? tier.next.minReferrals - referralCount : 0;

  useEffect(() => {
    supabase
      .from('profiles')
      .select('referral_count')
      .eq('id', profile.id)
      .maybeSingle()
      .then(({ data }) => setReferralCount((data as { referral_count?: number } | null)?.referral_count ?? 0));
  }, [profile.id]);

  const copy = async () => {
    await navigator.clipboard.writeText(referralLink);
    toast.success('Referral link copied');
  };

  return (
    <div className="space-y-4 w-full">
      <div className="blox-card p-5 overflow-hidden relative">
        <div className="absolute right-0 top-0 h-32 w-32 bg-primary/15 blur-3xl" aria-hidden="true" />
        <div className="relative flex items-center gap-4 min-w-0">
          <div className="h-12 w-12 rounded-lg bg-primary/15 flex items-center justify-center shrink-0">
            <Users className="h-6 w-6 text-primary drop-shadow-[0_0_10px_hsl(var(--primary)/0.9)]" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm text-muted-foreground">Referral tier</div>
            <h2 className="text-2xl md:text-3xl font-bold text-foreground truncate">Inactive</h2>
            <p className="text-sm text-muted-foreground mt-1 truncate">Referrals are not doing anything right now.</p>
          </div>
          <div className="text-right shrink-0">
            <div className="text-3xl md:text-4xl font-bold text-primary">{referralCount}</div>
            <div className="text-sm text-muted-foreground">total referrals</div>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-[minmax(0,1.25fr)_minmax(260px,0.75fr)] gap-4">
        <div className="blox-card p-5">
          <div className="flex items-center gap-2 mb-3">
            <LinkIcon className="h-5 w-5 text-primary drop-shadow-[0_0_8px_hsl(var(--primary)/0.9)]" />
            <h3 className="font-semibold text-lg">Your referral link</h3>
          </div>
          <div className="flex gap-2 min-w-0">
            <code className="flex-1 min-w-0 rounded-lg border border-primary/15 bg-background px-3 py-3 text-xs sm:text-sm text-muted-foreground truncate">
              {referralLink}
            </code>
            <button onClick={copy} className="rounded-lg bg-primary px-4 py-3 text-primary-foreground hover:brightness-110 transition-all shrink-0" aria-label="Copy referral link">
              <Copy className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="blox-card p-5">
          <div className="flex items-center gap-2 mb-2">
            <Gift className="h-5 w-5 text-primary drop-shadow-[0_0_8px_hsl(var(--primary)/0.9)]" />
            <h3 className="font-semibold text-lg">Next reward</h3>
          </div>
          {tier.next ? (
            <p className="text-sm text-muted-foreground">
              Referrals are currently disabled, so there is no active reward progress.
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">You are at the highest referral tier.</p>
          )}
        </div>
      </div>

      <div className="blox-card p-5">
        <h3 className="font-semibold text-lg mb-4">Tier progress</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {REFERRAL_TIERS.map((referralTier) => {
            const reached = referralCount >= referralTier.minReferrals;
            return (
              <div key={referralTier.name} className={`rounded-lg border p-3 min-w-0 ${reached ? 'border-primary/40 bg-primary/10' : 'border-border bg-background'}`}>
                <div className={`${reached ? 'text-primary' : 'text-muted-foreground'} font-bold truncate`}>{referralTier.name}</div>
                <div className="text-xs text-muted-foreground mt-1">{referralTier.minReferrals}+ referrals</div>
                <div className="text-xs text-muted-foreground mt-2">{referralTier.perk}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default ReferralsPage;