import React, { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, Trophy, Medal, Sparkles } from 'lucide-react';
import type { DashboardProfile } from './DashboardLayout';
import { getRank } from '@/config/toolsConfig';

interface Row {
  id: string;
  username: string;
  hit_count: number;
  total_robux: number;
  total_rap: number;
  anonymous: boolean;
  is_golden: boolean;
}

// Build a stable per-user "anonymous alias" so the owner can recognise their
// own row even when it shows as Anonymous to the rest of the world.
const aliasFor = (id: string) => {
  // 6-char hex from the uuid → e.g. "Anonymous#a1f3c2"
  const hex = id.replace(/-/g, '').slice(0, 6);
  return `Anonymous#${hex}`;
};

const LeaderboardPage = () => {
  const { profile } = useOutletContext<{ profile: DashboardProfile }>();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [myRank, setMyRank] = useState<number | null>(null);

  const load = React.useCallback(async () => {
    const top = await (supabase as any)
      .from('leaderboard')
      .select('id, username, hit_count, total_robux, total_rap, anonymous, is_golden')
      .order('hit_count', { ascending: false })
      .limit(50);
    if (top.error) {
      toast.error(top.error.message);
      setRows([]);
      return;
    }
    const list = (top.data ?? []) as Row[];
    setRows(list);

    const meIdx = list.findIndex((r) => r.id === profile.id);
    if (meIdx >= 0) {
      setMyRank(meIdx + 1);
    } else {
      const me = await (supabase as any)
        .from('leaderboard')
        .select('hit_count')
        .eq('id', profile.id)
        .maybeSingle();
      if (me.data) {
        const above = await (supabase as any)
          .from('leaderboard')
          .select('id', { count: 'exact', head: true })
          .gt('hit_count', me.data.hit_count);
        setMyRank((above.count ?? 0) + 1);
      }
    }
  }, [profile.id]);

  useEffect(() => {
    load();
    const channel = supabase
      .channel('leaderboard-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leaderboard' }, () => {
        load();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [load]);

  if (rows === null) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const medal = (i: number) => {
    if (i === 0) return <Trophy className="h-5 w-5 text-yellow-400" />;
    if (i === 1) return <Medal className="h-5 w-5 text-gray-300" />;
    if (i === 2) return <Medal className="h-5 w-5 text-amber-700" />;
    return <span className="text-gray-500 w-5 text-center text-sm">{i + 1}</span>;
  };

  return (
    <div className="space-y-4">
      <div className="blox-card p-5">
        <div className="text-sm text-gray-400">Your global position</div>
        <div className="text-2xl font-bold text-primary">
          {myRank ? `#${myRank}` : 'Unranked'}
        </div>
        {profile.anonymous_leaderboard && (
          <div className="text-xs text-muted-foreground mt-1">
            You're anonymous — others see you as{' '}
            <span className="text-foreground font-medium">{aliasFor(profile.id)}</span>
          </div>
        )}
      </div>

      <h2 className="text-lg font-semibold">Top 50 Beamers</h2>

      <div className="blox-card divide-y divide-white/5 overflow-hidden">
        {rows.length === 0 && (
          <div className="p-6 text-center text-gray-400">No data yet.</div>
        )}
        {rows.map((r, i) => {
          const rank = getRank(r.hit_count);
          const isMe = r.id === profile.id;
          // Real name shown to: the owner themselves, or anyone if not anonymous.
          const showRealName = isMe || !r.anonymous;
          const visibleName = showRealName ? `@${r.username}` : aliasFor(r.id);

          return (
            <div
              key={r.id}
              className={`flex items-center gap-3 p-3 ${isMe ? 'bg-primary/10' : ''}`}
            >
              <div className="w-6 flex justify-center">{medal(i)}</div>
              <div className="flex-1 min-w-0">
                <div className={`font-semibold truncate flex items-center gap-1.5 ${!r.is_golden && isMe ? 'text-primary' : ''}`}>
                  {r.is_golden && <Sparkles className="h-4 w-4 golden-sparkle text-yellow-300" />}
                  <span className={r.is_golden ? 'golden-name' : ''}>{visibleName}</span>
                  {r.is_golden && <Sparkles className="h-4 w-4 golden-sparkle text-yellow-300" />}
                  {isMe && (
                    <span className="text-xs text-gray-400 font-normal ml-1">
                      (you{r.anonymous ? ', hidden from others' : ''})
                    </span>
                  )}
                </div>
                <div className="text-xs text-gray-400">{rank.current.name}</div>
              </div>
              <div className="text-right text-sm">
                <div className="font-bold">{r.hit_count} hits</div>
                <div className="text-xs text-gray-400">{r.total_robux.toLocaleString()} R$ · {r.total_rap.toLocaleString()} RAP</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default LeaderboardPage;
