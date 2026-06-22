'use client';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { Trophy, TrendingUp, Crosshair } from 'lucide-react';
import { useLang } from '@/components/LangProvider';

function rankTier(team, t) {
  if (team && team.manual_rank) {
    const r = team.manual_rank.toLowerCase();
    if (r === 'master') return { name: 'Maestro', color: '#f43f5e' };
    if (r === 'diamond') return { name: t('c_rank_diamond'), color: '#5eead4' };
    if (r === 'platinum') return { name: t('c_rank_platinum'), color: '#a78bfa' };
    if (r === 'gold') return { name: t('c_rank_gold'), color: '#fbbf24' };
    if (r === 'silver') return { name: t('c_rank_silver'), color: '#94a3b8' };
    if (r === 'bronze') return { name: t('c_rank_bronze'), color: '#b45309' };
    return { name: team.manual_rank, color: '#fff' };
  }
  const elo = team?.elo || (typeof team === 'number' ? team : 0);
  if (elo >= 1800) return { name: t('c_rank_diamond'),  color: '#5eead4' };
  if (elo >= 1600) return { name: t('c_rank_platinum'), color: '#a78bfa' };
  if (elo >= 1400) return { name: t('c_rank_gold'),     color: '#fbbf24' };
  if (elo >= 1200) return { name: t('c_rank_silver'),   color: '#94a3b8' };
  return                  { name: t('c_rank_bronze'),   color: '#b45309' };
}

const CARD_BG  = '#111114';
const ROW_HOVER = '#16161a';

export default function LeaderboardPage() {
  const { t } = useLang();
  const [teams,   setTeams]   = useState([]);
  const [teams, setTeams] = useState([]);
  const [tab, setTab] = useState('elo');
  const [loading, setLoading] = useState(true);
  const [serverInfo, setServerInfo] = useState(null);

  const TABS = [
    { id: 'elo',  labelKey: 'c_lb_elo',  icon: <Trophy size={13} /> },
    { id: 'wins', labelKey: 'c_lb_wins', icon: <TrendingUp size={13} /> },
    { id: 'kd',   labelKey: 'c_lb_kd',   icon: <Crosshair size={13} /> },
  ];

  useEffect(() => {
    fetch(`/api/community/teams?server_id=${serverId}`).then(r => r.json()).then(d => {
      setTeams(Array.isArray(d) ? d : []);
    });
    fetch(`/api/community/servers`).then(r => r.json()).then(servers => {
      if (Array.isArray(servers)) {
        const s = servers.find(sv => sv.id === Number(serverId));
        setServerInfo(s || null);
      }
      setLoading(false);
    });
  }, [serverId]);

  const hasKd = serverInfo ? Boolean(serverInfo.has_kd) : true;

  const sorted = [...teams].sort((a, b) => {
    if (tab === 'elo')  return b.elo - a.elo;
    if (tab === 'wins') return b.wins - a.wins;
    if (tab === 'kd')   return (b.deaths > 0 ? b.kills/b.deaths : b.kills) - (a.deaths > 0 ? a.kills/a.deaths : a.kills);
    return 0;
  });

  return (
    <div className="space-y-8">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="text-xs font-black uppercase tracking-widest text-cyan-500 mb-2 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse inline-block" /> {t('c_lb_live')}
        </div>
        <h1 className="text-5xl md:text-6xl font-black uppercase tracking-tight mb-2 text-white">{t('c_lb_title')}</h1>
        <p className="text-zinc-400 text-sm">{t('c_lb_desc')}</p>
      </motion.div>

      <div className="flex gap-2 flex-wrap">
        {TABS.map(tb => (
          (tb.id !== 'kd' || hasKd) && (
            <button key={tb.id} onClick={() => setTab(tb.id)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all"
              style={tab === tb.id
                ? { background: 'rgba(6,182,212,0.12)', color: '#22d3ee', border: '1px solid rgba(6,182,212,0.3)' }
                : { background: '#111114', color: '#71717a', border: '1px solid rgba(255,255,255,0.07)' }}>
              {tb.icon}{t(tb.labelKey)}
            </button>
          )
        ))}
      </div>

      <div className="rounded-xl overflow-hidden" style={{ background: CARD_BG, border: '1px solid rgba(255,255,255,0.07)' }}>
        <div className="grid gap-4 px-6 py-3 border-b text-[10px] font-black uppercase tracking-widest text-zinc-600"
          style={{ gridTemplateColumns: `40px 1fr 90px 55px 55px ${hasKd ? '70px ' : ''}70px 80px`, borderColor: 'rgba(255,255,255,0.05)' }}>
          <div>#</div><div>{t('c_lb_team')}</div><div className="text-right">ELO</div>
          <div className="text-right">V</div><div className="text-right">D</div>
          {hasKd && <div className="text-right">K/D</div>}<div className="text-right">Win%</div><div className="text-right">{t('c_stat_streak')}</div>
        </div>

        {loading ? (
          <div className="py-20 flex justify-center"><div className="w-6 h-6 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" /></div>
        ) : sorted.length === 0 ? (
          <div className="py-20 text-center text-zinc-600 text-sm">{t('c_lb_no_teams')}</div>
        ) : sorted.map((team, i) => {
          const rank   = rankTier(team, t);
          const total  = team.wins + team.losses;
          const winPct = total > 0 ? Math.round((team.wins / total) * 100) : 0;
          const kd     = team.deaths > 0 ? (team.kills / team.deaths).toFixed(2) : team.kills;
          const streak = team.streak > 0 ? `▲${team.streak}W` : team.streak < 0 ? `▼${Math.abs(team.streak)}L` : '—';
          const streakColor = team.streak > 0 ? '#22c55e' : team.streak < 0 ? '#ef4444' : '#3f3f46';

          return (
            <motion.div key={team.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.025 }}>
              <Link href={`/comunidad/teams/${team.id}`}>
                <div className="grid gap-4 px-6 py-4 border-b items-center cursor-pointer group"
                  style={{ gridTemplateColumns: `40px 1fr 90px 55px 55px ${hasKd ? '70px ' : ''}70px 80px`, borderColor: 'rgba(255,255,255,0.04)' }}
                  onMouseEnter={e => e.currentTarget.style.background = ROW_HOVER}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <div className="text-zinc-600 font-black text-sm">{i + 1}</div>
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full overflow-hidden flex-shrink-0 flex items-center justify-center"
                      style={{ background: '#1c1c22', border: '1px solid rgba(255,255,255,0.08)' }}>
                      {team.logo_url ? <img src={team.logo_url} className="w-full h-full object-cover" /> : <span className="text-xs font-black text-zinc-400">{team.name[0]}</span>}
                    </div>
                    <div>
                      <div className="font-black text-sm text-white group-hover:text-cyan-400 transition-colors">{team.name}</div>
                      <span className="text-[9px] font-black px-1.5 py-0.5 rounded" style={{ color: rank.color, background: rank.color + '18' }}>{rank.name}</span>
                    </div>
                  </div>
                  <div className="text-right font-black text-sm" style={{ color: rank.color }}>{team.elo}</div>
                  <div className="text-right text-sm font-bold text-green-400">{team.wins}</div>
                  <div className="text-right text-sm font-bold text-red-400">{team.losses}</div>
                  {hasKd && <div className="text-right text-sm font-bold text-zinc-300">{kd}</div>}
                  <div className="text-right text-sm font-bold text-zinc-400">{winPct}%</div>
                  <div className="text-right text-xs font-black" style={{ color: streakColor }}>{streak}</div>
                </div>
              </Link>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
