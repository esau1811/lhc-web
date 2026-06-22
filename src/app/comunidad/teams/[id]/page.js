'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

function rankTier(elo) {
  if (elo >= 1800) return { name: 'Diamond',  color: '#5eead4' };
  if (elo >= 1600) return { name: 'Platinum', color: '#a78bfa' };
  if (elo >= 1400) return { name: 'Gold',     color: '#fbbf24' };
  if (elo >= 1200) return { name: 'Silver',   color: '#94a3b8' };
  return                  { name: 'Bronze',   color: '#b45309' };
}

export default function TeamProfilePage() {
  const { id } = useParams();
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');

  useEffect(() => {
    fetch(`/api/community/teams/${id}`)
      .then(r => r.json())
      .then(d => { if (d.error) setError(d.error); else setData(d); setLoading(false); });
  }, [id]);

  if (loading) return <div className="py-32 flex justify-center"><div className="w-8 h-8 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" /></div>;
  if (error)   return <div className="py-32 text-center text-red-400">{error}</div>;

  const { team, players, matches } = data;
  const rank  = rankTier(team.elo);
  const total = team.wins + team.losses;
  const winPct = total > 0 ? Math.round((team.wins / total) * 100) : 0;
  const kd = team.deaths > 0 ? (team.kills / team.deaths).toFixed(2) : team.kills.toFixed(2);

  return (
    <div className="space-y-8">
      <Link href="/comunidad/teams" className="inline-flex items-center gap-2 text-zinc-500 hover:text-white text-xs font-bold transition-colors">
        <ArrowLeft size={14} /> Todos los equipos
      </Link>

      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-6">
        <div className="w-20 h-20 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center overflow-hidden flex-shrink-0">
          {team.logo_url ? <img src={team.logo_url} className="w-full h-full object-cover" /> : <span className="text-3xl font-black text-zinc-400">{team.name[0]}</span>}
        </div>
        <div>
          <span className="text-[10px] font-black px-2 py-1 rounded mb-2 inline-block" style={{ color: rank.color, background: rank.color + '22' }}>{rank.name}</span>
          <h1 className="text-4xl font-black uppercase tracking-tight text-white">{team.name}</h1>
          {team.tag && <div className="text-zinc-500 text-sm font-bold mt-1">{team.tag}</div>}
        </div>
        <div className="ml-auto text-right">
          <div className="text-4xl font-black" style={{ color: rank.color }}>{team.elo}</div>
          <div className="text-xs text-zinc-500 font-bold">ELO</div>
        </div>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Victorias', value: team.wins,   color: '#22c55e' },
          { label: 'Derrotas',  value: team.losses, color: '#ef4444' },
          { label: 'K/D',       value: kd,          color: '#94a3b8' },
          { label: 'Win Rate',  value: `${winPct}%`,color: '#06b6d4' },
        ].map(s => (
          <div key={s.label} className="bg-white/3 border border-white/8 rounded-xl p-4 text-center">
            <div className="text-2xl font-black" style={{ color: s.color }}>{s.value}</div>
            <div className="text-xs text-zinc-500 font-bold uppercase tracking-wider mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Roster */}
        <div>
          <h2 className="text-sm font-black uppercase tracking-wider text-zinc-400 mb-4">Jugadores</h2>
          {players.length === 0 ? (
            <div className="bg-white/3 border border-white/8 rounded-xl p-8 text-center text-zinc-600 text-sm">Sin jugadores en este equipo</div>
          ) : (
            <div className="space-y-2">
              {players.map(p => (
                <Link key={p.id} href={`/comunidad/players/${p.id}`}
                  className="flex items-center gap-3 bg-white/3 border border-white/8 rounded-xl px-4 py-3 hover:border-white/20 transition-all group">
                  <div className="w-8 h-8 rounded-full bg-white/5 border border-white/10 overflow-hidden flex-shrink-0">
                    {p.discord_avatar ? <img src={p.discord_avatar} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-xs font-black text-zinc-400">{p.discord_name[0]}</div>}
                  </div>
                  <div className="flex-1">
                    <div className="font-black text-sm text-white group-hover:text-cyan-400 transition-colors">{p.discord_name}</div>
                    <div className="text-[10px] text-zinc-600">{p.wins}V {p.losses}D · {p.kills}K</div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Recent matches */}
        <div>
          <h2 className="text-sm font-black uppercase tracking-wider text-zinc-400 mb-4">Partidas Recientes</h2>
          {matches.length === 0 ? (
            <div className="bg-white/3 border border-white/8 rounded-xl p-8 text-center text-zinc-600 text-sm">Sin partidas registradas</div>
          ) : (
            <div className="space-y-2">
              {matches.map(m => {
                const isWinner = m.winner_team_id === team.id;
                return (
                  <div key={m.id} className="bg-white/3 border border-white/8 rounded-xl px-4 py-3">
                    <div className="flex items-center justify-between">
                      <span className={`text-xs font-black px-2 py-0.5 rounded ${isWinner ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>{isWinner ? 'VICTORIA' : 'DERROTA'}</span>
                      <div className="text-xs text-zinc-500 font-bold">{m.winner_kills} — {m.loser_kills}</div>
                      <div className="text-[10px] text-zinc-600">{new Date(m.played_at).toLocaleDateString('es-ES')}</div>
                    </div>
                    <div className="text-xs text-zinc-400 mt-1">vs {isWinner ? m.loser_name : m.winner_name}</div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
