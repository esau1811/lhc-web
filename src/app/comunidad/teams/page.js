'use client';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { Search } from 'lucide-react';

function rankTier(elo) {
  if (elo >= 1800) return { name: 'Diamond',  color: '#5eead4' };
  if (elo >= 1600) return { name: 'Platinum', color: '#a78bfa' };
  if (elo >= 1400) return { name: 'Gold',     color: '#fbbf24' };
  if (elo >= 1200) return { name: 'Silver',   color: '#94a3b8' };
  return                  { name: 'Bronze',   color: '#b45309' };
}

export default function TeamsPage() {
  const [teams,   setTeams]   = useState([]);
  const [query,   setQuery]   = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const url = query ? `/api/community/teams?q=${encodeURIComponent(query)}` : '/api/community/teams';
    const timer = setTimeout(() => {
      fetch(url).then(r => r.json()).then(d => { setTeams(Array.isArray(d) ? d : []); setLoading(false); });
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);

  return (
    <div className="space-y-8">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="text-xs font-black uppercase tracking-widest text-zinc-500 mb-2">ROSTER</div>
        <h1 className="text-5xl font-black uppercase tracking-tight mb-2">ALL TEAMS</h1>
        <p className="text-zinc-500">Todos los equipos registrados y sus estadísticas.</p>
      </motion.div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" />
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Buscar equipos..."
          className="w-full bg-white/3 border border-white/8 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-cyan-500/40 transition-all"
        />
      </div>

      {/* Grid */}
      {loading ? (
        <div className="py-16 flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" />
        </div>
      ) : teams.length === 0 ? (
        <div className="py-16 text-center text-zinc-600 text-sm">
          {query ? 'No se encontraron equipos' : 'Aún no hay equipos registrados'}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {teams.map((team, i) => {
            const rank  = rankTier(team.elo);
            const total = team.wins + team.losses;
            const winPct = total > 0 ? Math.round((team.wins / total) * 100) : 0;
            const kd = team.deaths > 0 ? (team.kills / team.deaths).toFixed(2) : team.kills.toFixed(2);
            const streak = team.streak > 0 ? `▲ ${team.streak}W` : team.streak < 0 ? `▼ ${Math.abs(team.streak)}L` : '—';
            const streakColor = team.streak > 0 ? '#22c55e' : team.streak < 0 ? '#ef4444' : '#52525b';

            return (
              <motion.div key={team.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
                <Link href={`/comunidad/teams/${team.id}`}
                  className="block bg-white/3 border border-white/8 rounded-xl p-5 hover:border-white/20 hover:bg-white/5 transition-all group">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-full bg-white/5 border border-white/10 flex items-center justify-center overflow-hidden">
                        {team.logo_url ? <img src={team.logo_url} className="w-full h-full object-cover" /> : <span className="text-sm font-black text-zinc-400">{team.name[0]}</span>}
                      </div>
                      <div>
                        <div className="font-black text-sm text-white group-hover:text-cyan-400 transition-colors uppercase">{team.name}</div>
                        <span className="text-[9px] font-black px-1.5 py-0.5 rounded mt-0.5 inline-block" style={{ color: rank.color, background: rank.color + '22' }}>{rank.name}</span>
                      </div>
                    </div>
                    <div className="font-black text-lg" style={{ color: rank.color }}>{team.elo}</div>
                  </div>
                  <div className="grid grid-cols-3 gap-3 mb-3">
                    <div><div className="text-[10px] text-zinc-600 uppercase font-bold">V</div><div className="font-black text-green-400">{team.wins}</div></div>
                    <div><div className="text-[10px] text-zinc-600 uppercase font-bold">D</div><div className="font-black text-red-400">{team.losses}</div></div>
                    <div><div className="text-[10px] text-zinc-600 uppercase font-bold">K/D</div><div className="font-black text-zinc-300">{kd}</div></div>
                  </div>
                  <div className="h-1 bg-white/5 rounded-full mb-3">
                    <div className="h-full bg-cyan-500 rounded-full transition-all" style={{ width: `${winPct}%` }} />
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-black" style={{ color: streakColor }}>{streak}</span>
                    <span className="text-[10px] text-cyan-500 font-bold group-hover:underline">Ver perfil →</span>
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
