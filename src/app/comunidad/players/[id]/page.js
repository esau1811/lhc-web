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

export default function PlayerProfilePage() {
  const { id } = useParams();
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');

  useEffect(() => {
    fetch(`/api/community/players/${id}`)
      .then(r => r.json())
      .then(d => { if (d.error) setError(d.error); else setData(d); setLoading(false); });
  }, [id]);

  if (loading) return <div className="py-32 flex justify-center"><div className="w-8 h-8 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" /></div>;
  if (error)   return <div className="py-32 text-center text-red-400">{error}</div>;

  const { player, matches } = data;
  const kd = player.deaths > 0 ? (player.kills / player.deaths).toFixed(2) : player.kills.toFixed(2);
  const total = player.wins + player.losses;
  const winPct = total > 0 ? Math.round((player.wins / total) * 100) : 0;
  const teamRank = player.team_elo ? rankTier(player.team_elo) : null;

  return (
    <div className="space-y-8">
      <Link href="/comunidad/players" className="inline-flex items-center gap-2 text-zinc-500 hover:text-white text-xs font-bold transition-colors">
        <ArrowLeft size={14} /> Todos los jugadores
      </Link>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-6">
        <div className="w-20 h-20 rounded-full bg-white/5 border border-white/10 overflow-hidden flex-shrink-0">
          {player.discord_avatar
            ? <img src={player.discord_avatar} className="w-full h-full object-cover" />
            : <div className="w-full h-full flex items-center justify-center text-3xl font-black text-zinc-400">{player.discord_name[0]}</div>}
        </div>
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-black text-zinc-600 bg-white/5 px-1.5 py-0.5 rounded">{player.role?.toUpperCase() || 'USER'}</span>
          </div>
          <h1 className="text-4xl font-black uppercase tracking-tight text-white">{player.discord_name}</h1>
          {player.team_name && (
            <Link href={`/comunidad/teams/${player.team_id}`} className="inline-flex items-center gap-1 mt-1">
              <span className="text-xs font-bold" style={{ color: teamRank?.color || '#94a3b8' }}>{player.team_name}</span>
              {teamRank && <span className="text-[9px] font-black px-1 py-0.5 rounded" style={{ color: teamRank.color, background: teamRank.color + '22' }}>{teamRank.name}</span>}
            </Link>
          )}
        </div>
      </motion.div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Victorias',  value: player.wins,    color: '#22c55e' },
          { label: 'Derrotas',   value: player.losses,  color: '#ef4444' },
          { label: 'K/D',        value: kd,             color: '#94a3b8' },
          { label: 'Win Rate',   value: `${winPct}%`,   color: '#06b6d4' },
        ].map(s => (
          <div key={s.label} className="bg-white/3 border border-white/8 rounded-xl p-4 text-center">
            <div className="text-2xl font-black" style={{ color: s.color }}>{s.value}</div>
            <div className="text-xs text-zinc-500 font-bold uppercase tracking-wider mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      <div>
        <h2 className="text-sm font-black uppercase tracking-wider text-zinc-400 mb-4">Partidas Recientes del Equipo</h2>
        {matches.length === 0 ? (
          <div className="bg-white/3 border border-white/8 rounded-xl p-8 text-center text-zinc-600 text-sm">Sin partidas registradas</div>
        ) : (
          <div className="space-y-2">
            {matches.map(m => {
              const isWinner = m.winner_team_id === player.team_id;
              return (
                <div key={m.id} className="flex items-center gap-4 bg-white/3 border border-white/8 rounded-xl px-5 py-3">
                  <span className={`text-[10px] font-black px-2 py-1 rounded flex-shrink-0 ${isWinner ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                    {isWinner ? 'WIN' : 'LOSS'}
                  </span>
                  <div className="flex-1 text-sm font-bold text-zinc-300">
                    {m.winner_name} <span className="text-zinc-600">vs</span> {m.loser_name}
                  </div>
                  <div className="text-xs font-black text-zinc-400">{m.winner_kills} — {m.loser_kills}</div>
                  <div className="text-[10px] text-zinc-600">{new Date(m.played_at).toLocaleDateString('es-ES')}</div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
