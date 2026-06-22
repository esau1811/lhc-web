'use client';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { Search, User } from 'lucide-react';

const CARD_BG   = '#111114';
const CARD_HOVER = '#16161a';
const ROW_STYLE  = { background: CARD_BG, border: '1px solid rgba(255,255,255,0.07)' };

export default function PlayersPage() {
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
        <h1 className="text-5xl md:text-6xl font-black uppercase tracking-tight mb-2 text-white">JUGADORES</h1>
        <p className="text-zinc-400 text-sm">Busca jugadores, consulta stats y el equipo al que pertenecen.</p>
      </motion.div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600 pointer-events-none" />
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Busca username o nombre..."
          style={{ background: '#111114', border: '1px solid rgba(255,255,255,0.07)', color: '#fff', outline: 'none' }}
          className="w-full rounded-xl pl-10 pr-4 py-3 text-sm placeholder-zinc-600 transition-all"
          onFocus={e => e.target.style.borderColor = 'rgba(6,182,212,0.35)'}
          onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.07)'}
        />
      </div>

      {loading ? (
        <div className="py-20 flex justify-center">
          <div className="w-6 h-6 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" />
        </div>
      ) : players.length === 0 ? (
        <div className="py-20 text-center text-zinc-600 text-sm rounded-xl" style={ROW_STYLE}>
          <User size={32} className="mx-auto mb-3 opacity-30" />
          {query ? 'No se encontraron jugadores' : 'Aún no hay jugadores registrados'}
        </div>
      ) : (
        <div className="rounded-xl overflow-hidden" style={ROW_STYLE}>
          {/* Header */}
          <div className="grid items-center gap-4 px-5 py-3 text-[10px] font-black uppercase tracking-widest text-zinc-600 border-b"
            style={{ gridTemplateColumns: '48px 1fr 140px 80px 80px 80px', borderColor: 'rgba(255,255,255,0.05)' }}>
            <div /><div>Jugador</div><div>Equipo</div>
            <div className="text-right">Win%</div><div className="text-right">K/D</div><div className="text-right">Partidas</div>
          </div>

          {players.map((p, i) => {
            const kd    = p.deaths > 0 ? (p.kills / p.deaths).toFixed(2) : p.kills;
            const total = p.wins + p.losses;
            const winPct = total > 0 ? Math.round((p.wins / total) * 100) : 0;

            return (
              <motion.div key={p.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }}>
                <Link href={`/comunidad/players/${p.id}`}>
                  <div className="grid items-center gap-4 px-5 py-3 border-b transition-colors duration-150 cursor-pointer group"
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
                    {/* Name + role */}
                    <div className="min-w-0">
                      <div className="font-black text-sm text-white truncate group-hover:text-cyan-400 transition-colors">{p.discord_name}</div>
                      <span className="text-[9px] font-black px-1.5 py-0.5 rounded"
                        style={{ background: 'rgba(255,255,255,0.06)', color: '#71717a' }}>
                        {p.role?.toUpperCase() || 'USER'}
                      </span>
                    </div>
                    {/* Team */}
                    <div className="min-w-0">
                      {p.team_name
                        ? <span className="text-xs font-bold text-zinc-300 truncate block">{p.team_name}</span>
                        : <span className="text-xs text-zinc-700">Sin equipo</span>}
                    </div>
                    <div className="text-right">
                      <div className="font-black text-sm text-white">{winPct}%</div>
                      <div className="text-[10px] text-zinc-600">{total} partidas</div>
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
