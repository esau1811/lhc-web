'use client';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { Search, User } from 'lucide-react';
import { useLang } from '@/components/LangProvider';

const CARD_BG   = '#111114';
const CARD_HOVER = '#16161a';

// Role badge config
function roleBadge(role) {
  const r = (role || '').toLowerCase();
  if (r === 'admin')  return { label: 'ADMIN', bg: 'rgba(239,68,68,0.12)',   color: '#f87171' };
  if (r === 'mod')    return { label: 'MOD',   bg: 'rgba(234,179,8,0.12)',   color: '#fbbf24' };
  if (r === 'staff')  return { label: 'STAFF', bg: 'rgba(168,85,247,0.12)',  color: '#c084fc' };
  if (r === 'vip')    return { label: 'VIP',   bg: 'rgba(6,182,212,0.12)',   color: '#22d3ee' };
  return                     { label: 'USER',  bg: 'rgba(255,255,255,0.06)', color: '#52525b' };
}

export default function PlayersPage() {
  const { t } = useLang();
  const [players, setPlayers] = useState([]);
  const [query,   setQuery]   = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const url = query ? `/api/community/players?q=${encodeURIComponent(query)}` : '/api/community/players';
    const timer = setTimeout(() => {
      fetch(url).then(r => r.json()).then(d => { setPlayers(Array.isArray(d) ? d : []); setLoading(false); });
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  return (
    <div className="space-y-8">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="text-xs font-black uppercase tracking-widest text-zinc-500 mb-2">PLAYERS</div>
        <h1 className="text-5xl md:text-6xl font-black uppercase tracking-tight mb-2 text-white">{t('c_players_title')}</h1>
        <p className="text-zinc-400 text-sm">{t('c_players_desc')}</p>
      </motion.div>

      <div className="relative max-w-md">
        <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600 pointer-events-none" />
        <input value={query} onChange={e => setQuery(e.target.value)} placeholder={t('c_players_search')}
          style={{ background: '#111114', border: '1px solid rgba(255,255,255,0.07)', color: '#fff', outline: 'none' }}
          className="w-full rounded-xl pl-10 pr-4 py-3 text-sm placeholder-zinc-600"
          onFocus={e => e.target.style.borderColor = 'rgba(6,182,212,0.35)'}
          onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.07)'} />
      </div>

      {loading ? (
        <div className="py-20 flex justify-center"><div className="w-6 h-6 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" /></div>
      ) : players.length === 0 ? (
        <div className="py-20 text-center text-zinc-600 text-sm rounded-xl" style={{ background: CARD_BG, border: '1px solid rgba(255,255,255,0.07)' }}>
          <User size={32} className="mx-auto mb-3 opacity-30" />
          {query ? t('c_players_empty_q') : t('c_players_empty')}
        </div>
      ) : (
        <div className="rounded-xl overflow-hidden" style={{ background: CARD_BG, border: '1px solid rgba(255,255,255,0.07)' }}>
          {/* Header */}
          <div className="grid items-center gap-4 px-5 py-3 text-[10px] font-black uppercase tracking-widest text-zinc-600 border-b"
            style={{ gridTemplateColumns: '48px 1fr 140px 80px 80px 80px', borderColor: 'rgba(255,255,255,0.05)' }}>
            <div /><div>{t('c_player_col')}</div><div>{t('c_lb_team')}</div>
            <div className="text-right">Win%</div><div className="text-right">K/D</div><div className="text-right">{t('c_stat_matches')}</div>
          </div>

          {players.map((p, i) => {
            const kd     = p.deaths > 0 ? (p.kills / p.deaths).toFixed(2) : p.kills;
            const total  = p.wins + p.losses;
            const winPct = total > 0 ? Math.round((p.wins / total) * 100) : 0;
            const badge  = roleBadge(p.role);

            return (
              <motion.div key={p.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }}>
                <Link href={`/comunidad/players/${p.id}`}>
                  <div className="grid items-center gap-4 px-5 py-3 border-b cursor-pointer group"
                    style={{ gridTemplateColumns: '48px 1fr 140px 80px 80px 80px', borderColor: 'rgba(255,255,255,0.04)' }}
                    onMouseEnter={e => e.currentTarget.style.background = CARD_HOVER}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    {/* Avatar */}
                    <div className="w-10 h-10 rounded-full overflow-hidden flex items-center justify-center flex-shrink-0"
                      style={{ background: '#1c1c22', border: '1px solid rgba(255,255,255,0.08)' }}>
                      {p.discord_avatar
                        ? <img src={p.discord_avatar} className="w-full h-full object-cover" />
                        : <span className="text-sm font-black text-zinc-400">{p.discord_name[0]}</span>}
                    </div>
                    {/* Name + role badge */}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="font-black text-sm text-white truncate group-hover:text-cyan-400 transition-colors">{p.discord_name}</span>
                        <span className="text-[9px] font-black px-1.5 py-0.5 rounded flex-shrink-0"
                          style={{ background: badge.bg, color: badge.color }}>{badge.label}</span>
                      </div>
                      <div className="text-[10px] text-zinc-600">{p.wins}V {p.losses}D · {p.kills}K</div>
                    </div>
                    {/* Team */}
                    <div className="min-w-0">
                      {p.team_name
                        ? <span className="text-xs font-bold text-zinc-300 truncate block">{p.team_name}</span>
                        : <span className="text-xs text-zinc-700">{t('c_players_no_team')}</span>}
                    </div>
                    <div className="text-right">
                      <div className="font-black text-sm text-white">{winPct}%</div>
                    </div>
                    <div className="text-right font-black text-sm text-zinc-300">{kd}</div>
                    <div className="text-right">
                      <div className="font-black text-sm text-zinc-300">{total}</div>
                      <div className="text-[10px] text-zinc-600">{p.wins}V {p.losses}D</div>
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
