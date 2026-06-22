'use client';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { Search } from 'lucide-react';

export default function PlayersPage() {
  const [players, setPlayers] = useState([]);
  const [query,   setQuery]   = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const url = query ? `/api/community/players?q=${encodeURIComponent(query)}` : '/api/community/players';
    const timer = setTimeout(() => {
      fetch(url).then(r => r.json()).then(d => { setPlayers(Array.isArray(d) ? d : []); setLoading(false); });
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);

  return (
    <div className="space-y-8">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="text-xs font-black uppercase tracking-widest text-zinc-500 mb-2">PLAYERS</div>
        <h1 className="text-5xl font-black uppercase tracking-tight mb-2">JUGADORES</h1>
        <p className="text-zinc-500">Busca jugadores, consulta stats y el equipo al que pertenecen.</p>
      </motion.div>

      <div className="relative max-w-md">
        <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" />
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Busca username o nombre..."
          className="w-full bg-white/3 border border-white/8 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-cyan-500/40 transition-all"
        />
      </div>

      {loading ? (
        <div className="py-16 flex justify-center"><div className="w-6 h-6 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" /></div>
      ) : players.length === 0 ? (
        <div className="py-16 text-center text-zinc-600 text-sm">{query ? 'No se encontraron jugadores' : 'Aún no hay jugadores registrados'}</div>
      ) : (
        <div className="space-y-2">
          {players.map((p, i) => {
            const kd = p.deaths > 0 ? (p.kills / p.deaths).toFixed(2) : p.kills.toFixed(2);
            const total = p.wins + p.losses;
            const winPct = total > 0 ? Math.round((p.wins / total) * 100) : 0;
            return (
              <motion.div key={p.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.02 }}>
                <Link href={`/comunidad/players/${p.id}`}
                  className="flex items-center gap-4 bg-white/3 border border-white/8 rounded-xl px-5 py-3 hover:border-white/20 hover:bg-white/5 transition-all group">
                  <div className="w-10 h-10 rounded-full bg-white/5 border border-white/10 overflow-hidden flex-shrink-0">
                    {p.discord_avatar
                      ? <img src={p.discord_avatar} className="w-full h-full object-cover" />
                      : <div className="w-full h-full flex items-center justify-center text-sm font-black text-zinc-400">{p.discord_name[0]}</div>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-black text-sm text-white group-hover:text-cyan-400 transition-colors uppercase truncate">{p.discord_name}</div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] font-black text-zinc-600 bg-white/5 px-1.5 py-0.5 rounded">{p.role?.toUpperCase() || 'USER'}</span>
                      {p.team_name && <span className="text-[10px] text-zinc-500 truncate">{p.team_name}</span>}
                    </div>
                  </div>
                  <div className="hidden md:flex items-center gap-6 text-right">
                    <div><div className="text-xs font-black text-zinc-300">{winPct}%</div><div className="text-[10px] text-zinc-600">Win Rate</div></div>
                    <div><div className="text-xs font-black text-zinc-300">{kd}</div><div className="text-[10px] text-zinc-600">K/D</div></div>
                    <div><div className="text-xs font-black text-zinc-300">{total}</div><div className="text-[10px] text-zinc-600">Partidas</div></div>
                  </div>
                  <div className="text-[10px] text-cyan-500 font-bold group-hover:underline">Ver →</div>
                </Link>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
