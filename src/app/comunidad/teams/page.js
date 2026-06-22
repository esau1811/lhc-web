'use client';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { Search, Users } from 'lucide-react';
import { useLang } from '@/components/LangProvider';
import { useServer } from '@/components/ServerProvider';

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

const CARD_BG = '#111114';
const CARD_HOVER = '#16161a';

export default function TeamsPage() {
  const { t } = useLang();
  const { serverId } = useServer();
  const [teams,   setTeams]   = useState([]);
  const [query,   setQuery]   = useState('');
  const [loading, setLoading] = useState(true);
  const [serverInfo, setServerInfo] = useState(null);

  useEffect(() => {
    setLoading(true);
    const url = query ? `/api/community/teams?q=${encodeURIComponent(query)}&server_id=${serverId}` : `/api/community/teams?server_id=${serverId}`;
    const timer = setTimeout(() => {
      fetch(url).then(r => r.json()).then(d => { setTeams(Array.isArray(d) ? d : []); setLoading(false); });
    }, 300);
    fetch(`/api/community/servers`).then(r => r.json()).then(servers => {
      if (Array.isArray(servers)) {
        const s = servers.find(sv => sv.id === Number(serverId));
        setServerInfo(s || null);
      }
    });
    return () => clearTimeout(timer);
  }, [query, serverId]);

  const hasKd = serverInfo ? Boolean(serverInfo.has_kd) : true;

  return (
    <div className="space-y-8">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="text-xs font-black uppercase tracking-widest text-zinc-500 mb-2">ROSTER</div>
        <h1 className="text-5xl md:text-6xl font-black uppercase tracking-tight mb-2 text-white">{t('c_teams_title')}</h1>
        <p className="text-zinc-400 text-sm">{t('c_teams_desc')}</p>
      </motion.div>

      <div className="relative max-w-md">
        <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600 pointer-events-none" />
        <input value={query} onChange={e => setQuery(e.target.value)} placeholder={t('c_teams_search')}
          style={{ background: '#111114', border: '1px solid rgba(255,255,255,0.07)', color: '#fff', outline: 'none' }}
          className="w-full rounded-xl pl-10 pr-4 py-3 text-sm placeholder-zinc-600 transition-all"
          onFocus={e => e.target.style.borderColor = 'rgba(6,182,212,0.35)'}
          onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.07)'} />
      </div>

      {loading ? (
        <div className="py-20 flex justify-center"><div className="w-6 h-6 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" /></div>
      ) : teams.length === 0 ? (
        <div className="py-20 text-center text-zinc-600 text-sm rounded-xl" style={{ background: CARD_BG, border: '1px solid rgba(255,255,255,0.07)' }}>
          <Users size={32} className="mx-auto mb-3 opacity-30" />
          {query ? t('c_teams_empty_q') : t('c_no_teams')}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {teams.map((team, i) => {
            const rank   = rankTier(team, t);
            const total  = team.wins + team.losses;
            const winPct = total > 0 ? Math.round((team.wins / total) * 100) : 0;
            const kd     = team.deaths > 0 ? (team.kills / team.deaths).toFixed(2) : team.kills;
            const streak = team.streak > 0 ? `▲${team.streak}W` : team.streak < 0 ? `▼${Math.abs(team.streak)}L` : '—';
            const streakColor = team.streak > 0 ? '#22c55e' : team.streak < 0 ? '#ef4444' : '#3f3f46';
            return (
              <motion.div key={team.id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
                <Link href={`/comunidad/teams/${team.id}`}>
                  <div style={{ background: CARD_BG, border: '1px solid rgba(255,255,255,0.07)' }}
                    className="block rounded-xl p-5 transition-all duration-200 cursor-pointer group"
                    onMouseEnter={e => { e.currentTarget.style.background = CARD_HOVER; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.14)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = CARD_BG; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)'; }}>
                    <div className="flex items-center justify-between mb-5">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-full overflow-hidden flex items-center justify-center flex-shrink-0"
                          style={{ background: '#1c1c22', border: '1px solid rgba(255,255,255,0.08)' }}>
                          {team.logo_url ? <img src={team.logo_url} className="w-full h-full object-cover" /> : <span className="text-base font-black text-zinc-400">{team.name[0]}</span>}
                        </div>
                        <div>
                          <div className="font-black text-sm text-white group-hover:text-cyan-400 transition-colors uppercase">{team.name}</div>
                          {team.tag && <div className="text-[10px] text-zinc-600 font-bold">[{team.tag}]</div>}
                          <span className="text-[9px] font-black px-1.5 py-0.5 rounded mt-0.5 inline-block" style={{ color: rank.color, background: rank.color + '18' }}>{rank.name}</span>
                        </div>
                      </div>
                      <div className="font-black text-xl" style={{ color: rank.color }}>{team.elo}</div>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mb-4">
                      <div className="rounded-lg px-3 py-2 text-center" style={{ background: 'rgba(255,255,255,0.04)' }}>
                        <div className="font-black text-sm text-green-500">{team.wins}</div>
                        <div className="text-[9px] text-zinc-600 font-black uppercase tracking-wider">V</div>
                      </div>
                      <div className="rounded-lg px-3 py-2 text-center" style={{ background: 'rgba(255,255,255,0.04)' }}>
                        <div className="font-black text-sm text-red-500">{team.losses}</div>
                        <div className="text-[9px] text-zinc-600 font-black uppercase tracking-wider">D</div>
                      </div>
                      {hasKd && (
                        <div className="rounded-lg px-3 py-2 text-center col-span-2 md:col-span-1" style={{ background: 'rgba(255,255,255,0.04)' }}>
                          <div className="font-black text-sm text-slate-400">{kd}</div>
                          <div className="text-[9px] text-zinc-600 font-black uppercase tracking-wider">K/D</div>
                        </div>
                      )}
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-zinc-500 uppercase font-black">{t('c_stat_win_pct')}</span>
                        <span className="text-zinc-300 font-bold">{winPct}%</span>
                      </div>
                      {hasKd && (
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-zinc-500 uppercase font-black">Kills Totales</span>
                          <span className="text-zinc-300 font-bold">{team.kills}</span>
                        </div>
                      )}
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-zinc-500 uppercase font-black">Streak</span>
                        <span className="font-bold" style={{ color: streakColor }}>{streak}</span>
                      </div>
                    </div>
                  </div>
                </Link>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
