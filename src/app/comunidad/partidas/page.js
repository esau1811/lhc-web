'use client';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

const CARD_BG   = '#111114';
const CARD_HOVER = '#16161a';

export default function PartidasPage() {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/community/matches').then(r => r.json())
      .then(d => { setMatches(Array.isArray(d) ? d : []); setLoading(false); });
  }, []);

  return (
    <div className="space-y-8">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="text-xs font-black uppercase tracking-widest text-cyan-500 mb-2 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse inline-block" /> LIVE
        </div>
        <h1 className="text-5xl md:text-6xl font-black uppercase tracking-tight mb-2 text-white">PARTIDAS RECIENTES</h1>
        <p className="text-zinc-400 text-sm">Historial completo de todas las partidas registradas.</p>
      </motion.div>

      <div className="rounded-xl overflow-hidden" style={{ background: CARD_BG, border: '1px solid rgba(255,255,255,0.07)' }}>
        <div className="grid gap-4 px-6 py-3 border-b text-[10px] font-black uppercase tracking-widest text-zinc-600"
          style={{ gridTemplateColumns: '55px 1fr 1fr 110px 110px 100px', borderColor: 'rgba(255,255,255,0.05)' }}>
          <div>ID</div><div>Ganador</div><div>Perdedor</div>
          <div className="text-center">ELO Δ</div><div className="text-center">Kills</div><div className="text-right">Fecha</div>
        </div>

        {loading ? (
          <div className="py-20 flex justify-center">
            <div className="w-6 h-6 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" />
          </div>
        ) : matches.length === 0 ? (
          <div className="py-20 text-center text-zinc-600 text-sm">Aún no hay partidas registradas</div>
        ) : matches.map((m, i) => {
          const wDelta = m.winner_elo_after - m.winner_elo_before;
          const lDelta = m.loser_elo_after  - m.loser_elo_before;
          return (
            <motion.div key={m.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }}>
              <div className="grid gap-4 px-6 py-4 border-b items-center transition-colors duration-150"
                style={{ gridTemplateColumns: '55px 1fr 1fr 110px 110px 100px', borderColor: 'rgba(255,255,255,0.04)' }}
                onMouseEnter={e => e.currentTarget.style.background = CARD_HOVER}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
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
                  <div className="text-xs font-black text-green-400">+{wDelta}</div>
                  <div className="text-xs font-black text-red-400">{lDelta}</div>
                </div>
                <div className="text-center">
                  <div className="text-xs font-black text-white">{m.winner_kills} — {m.loser_kills}</div>
                </div>
                <div className="text-right text-[10px] text-zinc-600">
                  {new Date(m.played_at).toLocaleDateString('es-ES')}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
