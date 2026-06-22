'use client';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { Trophy, Users, Clock, TrendingUp } from 'lucide-react';
import { getRankTier } from '@/lib/communityDb';

// We import getRankTier from a client-safe version
function rankTier(elo) {
  if (elo >= 1800) return { name: 'Diamond',  color: '#5eead4' };
  if (elo >= 1600) return { name: 'Platinum', color: '#a78bfa' };
  if (elo >= 1400) return { name: 'Gold',     color: '#fbbf24' };
  if (elo >= 1200) return { name: 'Silver',   color: '#94a3b8' };
  return                  { name: 'Bronze',   color: '#b45309' };
}

export default function ComunidadHome() {
  const [teams,   setTeams]   = useState([]);
  const [matches, setMatches] = useState([]);

  useEffect(() => {
    fetch('/api/community/teams').then(r => r.json()).then(d => setTeams(Array.isArray(d) ? d.slice(0, 5) : []));
    fetch('/api/community/matches').then(r => r.json()).then(d => setMatches(Array.isArray(d) ? d.slice(0, 5) : []));
  }, []);

  const stats = [
    { label: 'Equipos',  value: teams.length,   icon: <Users size={20} />,   href: '/comunidad/teams' },
    { label: 'Partidas', value: matches.length,  icon: <Clock size={20} />,   href: '/comunidad/partidas' },
    { label: 'Top ELO',  value: teams[0]?.elo ?? '—', icon: <Trophy size={20} />, href: '/comunidad/leaderboard' },
    { label: 'Racha',    value: teams[0]?.streak ?? '—', icon: <TrendingUp size={20} />, href: '/comunidad/leaderboard' },
  ];

  return (
    <div className="space-y-12">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="text-xs font-black uppercase tracking-widest text-cyan-500 mb-2">● LIVE</div>
        <h1 className="text-5xl font-black uppercase tracking-tight mb-3">LHC COMUNIDAD</h1>
        <p className="text-zinc-500 font-medium">Rankings competitivos, equipos y historial de partidas.</p>
      </motion.div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
            <Link href={s.href} className="block bg-white/3 border border-white/8 rounded-xl p-5 hover:border-cyan-500/30 hover:bg-cyan-500/5 transition-all group">
              <div className="text-cyan-500 mb-3 group-hover:scale-110 transition-transform inline-block">{s.icon}</div>
              <div className="text-2xl font-black text-white">{s.value}</div>
              <div className="text-xs text-zinc-500 font-bold uppercase tracking-wider mt-1">{s.label}</div>
            </Link>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Top 5 Teams */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-black uppercase tracking-wider text-zinc-400">Top Equipos</h2>
            <Link href="/comunidad/leaderboard" className="text-xs text-cyan-500 hover:text-cyan-400 font-bold">Ver todo →</Link>
          </div>
          <div className="space-y-2">
            {teams.length === 0 ? (
              <div className="bg-white/3 border border-white/8 rounded-xl p-8 text-center text-zinc-600 text-sm">Aún no hay equipos registrados</div>
            ) : teams.map((team, i) => {
              const rank = rankTier(team.elo);
              const kd   = team.deaths > 0 ? (team.kills / team.deaths).toFixed(2) : team.kills.toFixed(2);
              return (
                <Link key={team.id} href={`/comunidad/teams/${team.id}`}
                  className="flex items-center gap-4 bg-white/3 border border-white/8 rounded-xl px-4 py-3 hover:border-white/20 transition-all">
                  <span className="text-zinc-600 font-black text-sm w-5 text-center">{i + 1}</span>
                  <div className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center overflow-hidden flex-shrink-0">
                    {team.logo_url ? <img src={team.logo_url} className="w-full h-full object-cover" /> : <span className="text-xs font-black text-zinc-400">{team.name[0]}</span>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-black text-sm text-white truncate">{team.name}</div>
                    <span className="text-[10px] font-black px-1.5 py-0.5 rounded" style={{ color: rank.color, background: rank.color + '22' }}>{rank.name}</span>
                  </div>
                  <div className="text-right">
                    <div className="font-black text-sm" style={{ color: rank.color }}>{team.elo}</div>
                    <div className="text-[10px] text-zinc-500">{team.wins}W {team.losses}L</div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Recent Matches */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-black uppercase tracking-wider text-zinc-400">Partidas Recientes</h2>
            <Link href="/comunidad/partidas" className="text-xs text-cyan-500 hover:text-cyan-400 font-bold">Ver todo →</Link>
          </div>
          <div className="space-y-2">
            {matches.length === 0 ? (
              <div className="bg-white/3 border border-white/8 rounded-xl p-8 text-center text-zinc-600 text-sm">Aún no hay partidas registradas</div>
            ) : matches.map(m => (
              <div key={m.id} className="bg-white/3 border border-white/8 rounded-xl px-4 py-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-black text-sm text-green-400 truncate">{m.winner_name}</span>
                  <div className="text-center flex-shrink-0">
                    <div className="text-[10px] font-black text-zinc-500">
                      {m.winner_kills} — {m.loser_kills}
                    </div>
                  </div>
                  <span className="font-black text-sm text-red-400 truncate text-right">{m.loser_name}</span>
                </div>
                <div className="text-[10px] text-zinc-600 mt-1">{new Date(m.played_at).toLocaleDateString('es-ES')}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
