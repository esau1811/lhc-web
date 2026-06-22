'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { useLang } from '@/components/LangProvider';

function rankTier(elo, t) {
  if (elo >= 1800) return { name: t('c_rank_diamond'),  color: '#5eead4' };
  if (elo >= 1600) return { name: t('c_rank_platinum'), color: '#a78bfa' };
  if (elo >= 1400) return { name: t('c_rank_gold'),     color: '#fbbf24' };
  if (elo >= 1200) return { name: t('c_rank_silver'),   color: '#94a3b8' };
  return                  { name: t('c_rank_bronze'),   color: '#b45309' };
}

function roleBadge(role) {
  const r = (role || '').toLowerCase();
  if (r === 'admin') return { label: 'ADMIN', bg: 'rgba(239,68,68,0.12)',   color: '#f87171' };
  if (r === 'mod')   return { label: 'MOD',   bg: 'rgba(234,179,8,0.12)',   color: '#fbbf24' };
  if (r === 'staff') return { label: 'STAFF', bg: 'rgba(168,85,247,0.12)',  color: '#c084fc' };
  if (r === 'vip')   return { label: 'VIP',   bg: 'rgba(6,182,212,0.12)',   color: '#22d3ee' };
  return                    { label: 'USER',  bg: 'rgba(255,255,255,0.06)', color: '#52525b' };
}

const CARD_BG    = '#111114';
const CARD_HOVER = '#16161a';

export default function PlayerProfilePage() {
  const { id } = useParams();
  const { t }  = useLang();
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');

  useEffect(() => {
    fetch(`/api/community/players/${id}`).then(r => r.json())
      .then(d => { if (d.error) setError(d.error); else setData(d); setLoading(false); });
  }, [id]);

  if (loading) return <div className="py-32 flex justify-center"><div className="w-8 h-8 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" /></div>;
  if (error)   return <div className="py-32 text-center text-red-400">{error}</div>;

  const { player, matches } = data;
  const kd      = player.deaths > 0 ? (player.kills / player.deaths).toFixed(2) : player.kills;
  const total   = player.wins + player.losses;
  const winPct  = total > 0 ? Math.round((player.wins / total) * 100) : 0;
  const teamRank = player.team_elo ? rankTier(player.team_elo, t) : null;
  const badge    = roleBadge(player.role);

  return (
    <div className="space-y-8">
      <Link href="/comunidad/players" className="inline-flex items-center gap-2 text-zinc-600 hover:text-white text-xs font-bold transition-colors">
        <ArrowLeft size={13} /> {t('c_back_players')}
      </Link>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl p-6 flex items-center gap-6 flex-wrap"
        style={{ background: CARD_BG, border: '1px solid rgba(255,255,255,0.07)' }}>
        <div className="w-20 h-20 rounded-full overflow-hidden flex items-center justify-center flex-shrink-0"
          style={{ background: '#1c1c22', border: '2px solid rgba(255,255,255,0.08)' }}>
          {player.discord_avatar ? <img src={player.discord_avatar} className="w-full h-full object-cover" /> : <span className="text-4xl font-black text-zinc-400">{player.discord_name[0]}</span>}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="text-[10px] font-black px-2 py-1 rounded" style={{ background: badge.bg, color: badge.color }}>{badge.label}</span>
          </div>
          <h1 className="text-4xl font-black uppercase tracking-tight text-white">{player.discord_name}</h1>
          {player.team_name ? (
            <Link href={`/comunidad/teams/${player.team_id}`} className="inline-flex items-center gap-2 mt-2">
              <span className="text-sm font-bold" style={{ color: teamRank?.color || '#94a3b8' }}>{player.team_name}</span>
              {teamRank && <span className="text-[9px] font-black px-1.5 py-0.5 rounded" style={{ color: teamRank.color, background: teamRank.color + '18' }}>{teamRank.name}</span>}
            </Link>
          ) : (
            <div className="text-zinc-700 text-sm mt-1">{t('c_players_no_team')}</div>
          )}
        </div>
      </motion.div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { labelKey: 'c_team_wins',    value: player.wins,    color: '#22c55e' },
          { labelKey: 'c_team_losses',  value: player.losses,  color: '#ef4444' },
          { labelKey: 'c_lb_kd',        value: kd,             color: '#94a3b8' },
          { labelKey: 'c_team_winrate', value: `${winPct}%`,   color: '#06b6d4' },
        ].map(s => (
          <div key={s.labelKey} className="rounded-xl p-4 text-center" style={{ background: CARD_BG, border: '1px solid rgba(255,255,255,0.07)' }}>
            <div className="text-3xl font-black mb-1" style={{ color: s.color }}>{s.value}</div>
            <div className="text-[10px] text-zinc-600 font-black uppercase tracking-widest">{t(s.labelKey)}</div>
          </div>
        ))}
      </div>

      <div>
        <h2 className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-4">{t('c_team_matches_title')}</h2>
        {matches.length === 0 ? (
          <div className="py-12 text-center text-zinc-700 text-sm rounded-xl" style={{ background: CARD_BG, border: '1px solid rgba(255,255,255,0.07)' }}>{t('c_team_no_matches')}</div>
        ) : (
          <div className="rounded-xl overflow-hidden" style={{ background: CARD_BG, border: '1px solid rgba(255,255,255,0.07)' }}>
            {matches.map(m => {
              const isWin = m.winner_team_id === player.team_id;
              return (
                <div key={m.id} className="flex items-center gap-4 px-5 py-3 border-b"
                  style={{ borderColor: 'rgba(255,255,255,0.04)' }}
                  onMouseEnter={e => e.currentTarget.style.background = CARD_HOVER}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <span className="text-[10px] font-black px-2 py-1 rounded flex-shrink-0"
                    style={isWin ? { background: 'rgba(34,197,94,0.12)', color: '#22c55e' } : { background: 'rgba(239,68,68,0.12)', color: '#ef4444' }}>
                    {isWin ? t('c_win') : t('c_loss')}
                  </span>
                  <div className="flex-1 text-sm font-bold text-zinc-300">
                    {m.winner_name} <span className="text-zinc-700">vs</span> {m.loser_name}
                  </div>
                  <div className="text-xs font-black text-zinc-400">{m.winner_kills} — {m.loser_kills}</div>
                  <div className="text-[10px] text-zinc-700">{new Date(m.played_at).toLocaleDateString()}</div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
