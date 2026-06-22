'use client';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { Trophy, TrendingUp, Crosshair } from 'lucide-react';

function rankTier(elo) {
  if (elo >= 1800) return { name: 'Diamond',  color: '#5eead4' };
  if (elo >= 1600) return { name: 'Platinum', color: '#a78bfa' };
  if (elo >= 1400) return { name: 'Gold',     color: '#fbbf24' };
  if (elo >= 1200) return { name: 'Silver',   color: '#94a3b8' };
  return                  { name: 'Bronze',   color: '#b45309' };
}

const TABS = [
  { id: 'elo',    label: 'ELO Ranking',  icon: <Trophy size={13} /> },
  { id: 'wins',   label: 'Win Ranking',  icon: <TrendingUp size={13} /> },
  { id: 'kd',     label: 'K/D Ranking',  icon: <Crosshair size={13} /> },
];

export default function LeaderboardPage() {
  const [teams, setTeams] = useState([]);
  const [tab,   setTab]   = useState('elo');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch('/api/community/teams')
      .then(r => r.json())
      .then(d => { setTeams(Array.isArray(d) ? d : []); setLoading(false); });
  }, []);

  const sorted = [...teams].sort((a, b) => {
    if (tab === 'elo')  return b.elo - a.elo;
    if (tab === 'wins') return b.wins - a.wins;
    if (tab === 'kd') {
      const kdA = a.deaths > 0 ? a.kills / a.deaths : a.kills;
      const kdB = b.deaths > 0 ? b.kills / b.deaths : b.kills;
      return kdB - kdA;
    }
    return 0;
  });

  return (
    <div className="space-y-8">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="text-xs font-black uppercase tracking-widest text-cyan-500 mb-2">● LIVE RANKINGS</div>
        <h1 className="text-5xl font-black uppercase tracking-tight mb-2">LEADERBOARD</h1>
        <p className="text-zinc-500">Rankings competitivos actualizados tras cada partida.</p>
      </motion.div>

      {/* Tabs */}
      <div className="flex gap-2">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all
              ${tab === t.id ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40' : 'bg-white/3 border border-white/8 text-zinc-500 hover:text-white'}`}>
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white/3 border border-white/8 rounded-xl overflow-hidden">
        {/* Header */}
        <div className="grid grid-cols-[40px_1fr_100px_60px_60px_80px_80px_80px] gap-4 px-6 py-3 border-b border-white/5 text-[10px] font-black uppercase tracking-wider text-zinc-600">
          <div>#</div>
          <div>Equipo</div>
          <div className="text-right">ELO</div>
          <div className="text-right">V</div>
          <div className="text-right">D</div>
          <div className="text-right">K/D</div>
          <div className="text-right">Win%</div>
          <div className="text-right">Racha</div>
        </div>

        {loading ? (
          <div className="py-16 flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" />
          </div>
        ) : sorted.length === 0 ? (
          <div className="py-16 text-center text-zinc-600 text-sm">Aún no hay equipos registrados</div>
        ) : sorted.map((team, i) => {
          const rank  = rankTier(team.elo);
          const total = team.wins + team.losses;
          const winPct = total > 0 ? Math.round((team.wins / total) * 100) : 0;
          const kd = team.deaths > 0 ? (team.kills / team.deaths).toFixed(2) : team.kills.toFixed(2);
          const streak = team.streak > 0 ? `▲ ${team.streak}W` : team.streak < 0 ? `▼ ${Math.abs(team.streak)}L` : '—';
          const streakColor = team.streak > 0 ? '#22c55e' : team.streak < 0 ? '#ef4444' : '#52525b';

          return (
            <motion.div key={team.id}
              initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }}>
              <Link href={`/comunidad/teams/${team.id}`}
                className="grid grid-cols-[40px_1fr_100px_60px_60px_80px_80px_80px] gap-4 px-6 py-4 border-b border-white/5 hover:bg-white/3 transition-all items-center group">
                <div className="text-zinc-600 font-black text-sm">{i + 1}</div>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-white/5 border border-white/10 flex items-center justify-center overflow-hidden flex-shrink-0">
                    {team.logo_url ? <img src={team.logo_url} className="w-full h-full object-cover" /> : <span className="text-xs font-black text-zinc-400">{team.name[0]}</span>}
                  </div>
                  <div>
                    <div className="font-black text-sm text-white group-hover:text-cyan-400 transition-colors">{team.name}</div>
                    <span className="text-[9px] font-black px-1.5 py-0.5 rounded" style={{ color: rank.color, background: rank.color + '22' }}>{rank.name}</span>
                  </div>
                </div>
                <div className="text-right font-black text-sm" style={{ color: rank.color }}>{team.elo}</div>
                <div className="text-right text-sm font-bold text-green-400">{team.wins}</div>
                <div className="text-right text-sm font-bold text-red-400">{team.losses}</div>
                <div className="text-right text-sm font-bold text-zinc-300">{kd}</div>
                <div className="text-right text-sm font-bold text-zinc-400">{winPct}%</div>
                <div className="text-right text-xs font-black" style={{ color: streakColor }}>{streak}</div>
              </Link>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
