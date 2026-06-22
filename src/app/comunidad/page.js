'use client';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { Trophy, Users, Clock, Crosshair } from 'lucide-react';
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

const CARD = { background: '#111114', border: '1px solid rgba(255,255,255,0.07)' };
const CARD_HOVER = { background: '#16161a', border: '1px solid rgba(255,255,255,0.07)' };

export default function ComunidadHome() {
  const { t } = useLang();
  const [teams,   setTeams]   = useState([]);
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch('/api/community/teams').then(r => r.json()),
      fetch('/api/community/matches').then(r => r.json()),
    ]).then(([tm, m]) => {
      setTeams(Array.isArray(tm) ? tm.slice(0, 5) : []);
      setMatches(Array.isArray(m)  ? m.slice(0, 6)  : []);
      setLoading(false);
    });
  }, []);

  const stats = [
    { labelKey: 'c_stat_teams',   value: teams.length,        icon: <Users size={22} />,     href: '/comunidad/teams' },
    { labelKey: 'c_stat_matches', value: matches.length,       icon: <Clock size={22} />,     href: '/comunidad/partidas' },
    { labelKey: 'c_stat_top_elo', value: teams[0]?.elo ?? '—', icon: <Trophy size={22} />,    href: '/comunidad/leaderboard' },
    { labelKey: 'c_stat_streak',  value: teams[0]
        ? (teams[0].streak > 0 ? `▲${teams[0].streak}W` : teams[0].streak < 0 ? `▼${Math.abs(teams[0].streak)}L` : '—')
        : '—',
      icon: <Crosshair size={22} />, href: '/comunidad/leaderboard' },
  ];

  return (
    <div className="space-y-10">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="text-xs font-black uppercase tracking-widest text-cyan-500 mb-2 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse inline-block" /> {t('c_live')}
        </div>
        <h1 className="text-5xl md:text-6xl font-black uppercase tracking-tight mb-3 text-white">{t('c_community_title')}</h1>
        <p className="text-zinc-400 font-medium text-sm">{t('c_community_desc')}</p>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map((s, i) => (
          <motion.div key={s.labelKey} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}>
            <Link href={s.href}>
              <div style={CARD} className="rounded-xl p-5 transition-all duration-200 group cursor-pointer"
                onMouseEnter={e => Object.assign(e.currentTarget.style, CARD_HOVER)}
                onMouseLeave={e => Object.assign(e.currentTarget.style, CARD)}>
                <div className="text-cyan-500 mb-4 group-hover:scale-110 transition-transform inline-block">{s.icon}</div>
                <div className="text-3xl font-black text-white">{loading ? '—' : s.value}</div>
                <div className="text-[10px] text-zinc-500 font-black uppercase tracking-wider mt-1">{t(s.labelKey)}</div>
              </div>
            </Link>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Top 5 Teams */}
        <div>
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-xs font-black uppercase tracking-widest text-zinc-400">{t('c_top_teams')}</h2>
            <Link href="/comunidad/leaderboard" className="text-xs text-cyan-500 hover:text-cyan-400 font-bold transition-colors">{t('c_see_ranking')}</Link>
          </div>
          <div className="space-y-2">
            {loading && <div className="py-12 flex justify-center"><div className="w-5 h-5 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin"/></div>}
            {!loading && teams.length === 0 && (
              <div style={CARD} className="rounded-xl p-10 text-center text-zinc-600 text-sm">{t('c_no_teams')}</div>
            )}
            {teams.map((team, i) => {
              const rank = rankTier(team, t);
              return (
                <Link key={team.id} href={`/comunidad/teams/${team.id}`}>
                  <div style={CARD} className="flex items-center gap-4 rounded-xl px-4 py-3 transition-all duration-200 cursor-pointer"
                    onMouseEnter={e => Object.assign(e.currentTarget.style, CARD_HOVER)}
                    onMouseLeave={e => Object.assign(e.currentTarget.style, CARD)}>
                    <span className="text-zinc-600 font-black text-sm w-5 text-center flex-shrink-0">{i + 1}</span>
                    <div className="w-9 h-9 rounded-full flex items-center justify-center overflow-hidden flex-shrink-0"
                      style={{ background: '#1c1c21', border: '1px solid rgba(255,255,255,0.1)' }}>
                      {team.logo_url ? <img src={team.logo_url} className="w-full h-full object-cover" /> : <span className="text-xs font-black text-zinc-400">{team.name[0]}</span>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-black text-sm text-white truncate group-hover:text-cyan-400">{team.name}</div>
                      <span className="text-[9px] font-black px-1.5 py-0.5 rounded" style={{ color: rank.color, background: rank.color + '18' }}>{rank.name}</span>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="font-black text-sm" style={{ color: rank.color }}>{team.elo}</div>
                      <div className="text-[10px] text-zinc-600">{team.wins}V {team.losses}D</div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Recent Matches */}
        <div>
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-xs font-black uppercase tracking-widest text-zinc-400">{t('c_recent_matches')}</h2>
            <Link href="/comunidad/partidas" className="text-xs text-cyan-500 hover:text-cyan-400 font-bold transition-colors">{t('c_see_all')}</Link>
          </div>
          <div className="space-y-2">
            {loading && <div className="py-12 flex justify-center"><div className="w-5 h-5 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin"/></div>}
            {!loading && matches.length === 0 && (
              <div style={CARD} className="rounded-xl p-10 text-center text-zinc-600 text-sm">{t('c_no_matches')}</div>
            )}
            {matches.map(m => (
              <div key={m.id} style={CARD} className="rounded-xl px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-black text-sm text-green-400 truncate flex-1">{m.winner_name}</span>
                  <div className="flex-shrink-0 text-center">
                    <div className="text-[10px] font-black text-zinc-500 px-2 py-0.5 rounded" style={{ background: 'rgba(255,255,255,0.05)' }}>{m.winner_kills} — {m.loser_kills}</div>
                  </div>
                  <span className="font-black text-sm text-red-400 truncate flex-1 text-right">{m.loser_name}</span>
                </div>
                <div className="text-[10px] text-zinc-600 mt-1">{new Date(m.played_at).toLocaleDateString()}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
