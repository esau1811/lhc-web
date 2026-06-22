'use client';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

export default function PartidasPage() {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/community/matches')
      .then(r => r.json())
      .then(d => { setMatches(Array.isArray(d) ? d : []); setLoading(false); });
  }, []);

  return (
    <div className="space-y-8">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="text-xs font-black uppercase tracking-widest text-cyan-500 mb-2">● LIVE</div>
        <h1 className="text-5xl font-black uppercase tracking-tight mb-2">PARTIDAS RECIENTES</h1>
        <p className="text-zinc-500">Historial completo de todas las partidas registradas.</p>
      </motion.div>

      <div className="bg-white/3 border border-white/8 rounded-xl overflow-hidden">
        <div className="grid grid-cols-[60px_1fr_1fr_120px_120px_100px] gap-4 px-6 py-3 border-b border-white/5 text-[10px] font-black uppercase tracking-wider text-zinc-600">
          <div>ID</div>
          <div>Ganador</div>
          <div>Perdedor</div>
          <div className="text-center">ELO Δ</div>
          <div className="text-center">Kills</div>
          <div className="text-right">Fecha</div>
        </div>

        {loading ? (
          <div className="py-16 flex justify-center"><div className="w-6 h-6 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" /></div>
        ) : matches.length === 0 ? (
          <div className="py-16 text-center text-zinc-600 text-sm">Aún no hay partidas registradas</div>
        ) : matches.map((m, i) => {
          const winnerDelta = m.winner_elo_after - m.winner_elo_before;
          const loserDelta  = m.loser_elo_after  - m.loser_elo_before;
          return (
            <motion.div key={m.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }}
              className="grid grid-cols-[60px_1fr_1fr_120px_120px_100px] gap-4 px-6 py-4 border-b border-white/5 hover:bg-white/3 transition-all items-center">
              <div className="text-zinc-600 text-xs font-bold">#{m.id}</div>
              <div>
                <div className="font-black text-sm text-green-400 truncate">{m.winner_name}</div>
                {m.winner_tag && <div className="text-[10px] text-zinc-600">[{m.winner_tag}]</div>}
              </div>
              <div>
                <div className="font-black text-sm text-red-400 truncate">{m.loser_name}</div>
                {m.loser_tag && <div className="text-[10px] text-zinc-600">[{m.loser_tag}]</div>}
              </div>
              <div className="text-center">
                <div className="text-xs font-black text-green-400">+{winnerDelta}</div>
                <div className="text-xs font-black text-red-400">{loserDelta}</div>
              </div>
              <div className="text-center text-xs font-black text-zinc-300">{m.winner_kills} — {m.loser_kills}</div>
              <div className="text-right text-[10px] text-zinc-600">{new Date(m.played_at).toLocaleDateString('es-ES')}</div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
