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

const CARD_BG    = '#111114';
const CARD_HOVER = '#16161a';

export default function TeamProfilePage() {
  const { id } = useParams();
  const { t }  = useLang();
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');

  useEffect(() => {
    fetch(`/api/community/teams/${id}`).then(r => r.json())
      .then(d => { if (d.error) setError(d.error); else setData(d); setLoading(false); });
  }, [id]);

  if (loading) return <div className="py-32 flex justify-center"><div className="w-8 h-8 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" /></div>;
  if (error)   return <div className="py-32 text-center text-red-400">{error}</div>;

  const { team, players, matches } = data;
  const rank   = rankTier(team.elo, t);
  const total  = team.wins + team.losses;
  const winPct = total > 0 ? Math.round((team.wins / total) * 100) : 0;
  const kd     = team.deaths > 0 ? (team.kills / team.deaths).toFixed(2) : team.kills;
  const streak = team.streak > 0 ? `▲${team.streak}W` : team.streak < 0 ? `▼${Math.abs(team.streak)}L` : '—';
  const streakColor = team.streak > 0 ? '#22c55e' : team.streak < 0 ? '#ef4444' : '#52525b';

  return (
    <div className="space-y-8">
      <Link href="/comunidad/teams" className="inline-flex items-center gap-2 text-zinc-600 hover:text-white text-xs font-bold transition-colors">
        <ArrowLeft size={13} /> {t('c_back_teams')}
      </Link>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl p-6 flex items-center gap-6 flex-wrap"
        style={{ background: CARD_BG, border: '1px solid rgba(255,255,255,0.07)' }}>
        <div className="w-20 h-20 rounded-2xl overflow-hidden flex items-center justify-center flex-shrink-0"
          style={{ background: '#1c1c22', border: '1px solid rgba(255,255,255,0.08)' }}>
          {team.logo_url ? <img src={team.logo_url} className="w-full h-full object-cover" /> : <span className="text-4xl font-black text-zinc-400">{team.name[0]}</span>}
        </div>
        <div className="flex-1">
          <span className="text-[10px] font-black px-2 py-1 rounded mb-2 inline-block" style={{ color: rank.color, background: rank.color + '18' }}>{rank.name}</span>
          <h1 className="text-4xl font-black uppercase tracking-tight text-white">{team.name}</h1>
          {team.tag && <div className="text-zinc-600 text-sm font-bold mt-1">[{team.tag}]</div>}
        </div>
        <div className="text-right">
          <div className="text-5xl font-black" style={{ color: rank.color }}>{team.elo}</div>
          <div className="text-xs text-zinc-600 font-bold uppercase tracking-widest mt-1">ELO · <span style={{ color: streakColor }}>{streak}</span></div>
        </div>
      </motion.div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { labelKey: 'c_team_wins',    value: team.wins,    color: '#22c55e' },
          { labelKey: 'c_team_losses',  value: team.losses,  color: '#ef4444' },
          { labelKey: 'c_lb_kd',        value: kd,           color: '#94a3b8' },
          { labelKey: 'c_team_winrate', value: `${winPct}%`, color: '#06b6d4' },
        ].map(s => (
          <div key={s.labelKey} className="rounded-xl p-4 text-center" style={{ background: CARD_BG, border: '1px solid rgba(255,255,255,0.07)' }}>
            <div className="text-3xl font-black mb-1" style={{ color: s.color }}>{s.value}</div>
            <div className="text-[10px] text-zinc-600 font-black uppercase tracking-widest">{t(s.labelKey)}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div>
          <h2 className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-4">{t('c_team_players')}</h2>
          {players.length === 0 ? (
            <div className="py-12 text-center text-zinc-700 text-sm rounded-xl" style={{ background: CARD_BG, border: '1px solid rgba(255,255,255,0.07)' }}>{t('c_team_no_players')}</div>
          ) : (
            <div className="rounded-xl overflow-hidden" style={{ background: CARD_BG, border: '1px solid rgba(255,255,255,0.07)' }}>
              {players.map(p => (
                <Link key={p.id} href={`/comunidad/players/${p.id}`}>
                  <div className="flex items-center gap-3 px-4 py-3 border-b cursor-pointer group"
                    style={{ borderColor: 'rgba(255,255,255,0.04)' }}
                    onMouseEnter={e => e.currentTarget.style.background = CARD_HOVER}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <div className="w-9 h-9 rounded-full overflow-hidden flex-shrink-0 flex items-center justify-center"
                      style={{ background: '#1c1c22', border: '1px solid rgba(255,255,255,0.08)' }}>
                      {p.discord_avatar ? <img src={p.discord_avatar} className="w-full h-full object-cover" /> : <span className="text-xs font-black text-zinc-400">{p.discord_name[0]}</span>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-black text-sm text-white truncate group-hover:text-cyan-400 transition-colors">{p.discord_name}</div>
                      <div className="text-[10px] text-zinc-600">{p.wins}V {p.losses}D · {p.kills}K</div>
                    </div>
                    <div className="text-zinc-600 text-xs">→</div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div>
          <h2 className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-4">{t('c_team_matches')}</h2>
          {matches.length === 0 ? (
            <div className="py-12 text-center text-zinc-700 text-sm rounded-xl" style={{ background: CARD_BG, border: '1px solid rgba(255,255,255,0.07)' }}>{t('c_team_no_matches')}</div>
          ) : (
            <div className="space-y-2">
              {matches.map(m => {
                const isWin = m.winner_team_id === team.id;
                return (
                  <div key={m.id} className="rounded-xl px-4 py-3" style={{ background: CARD_BG, border: '1px solid rgba(255,255,255,0.07)' }}>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-[10px] font-black px-2 py-0.5 rounded flex-shrink-0"
                        style={isWin ? { background: 'rgba(34,197,94,0.12)', color: '#22c55e' } : { background: 'rgba(239,68,68,0.12)', color: '#ef4444' }}>
                        {isWin ? t('c_victory') : t('c_defeat')}
                      </span>
                      <div className="text-xs font-black text-zinc-400">{m.winner_kills} — {m.loser_kills}</div>
                      <div className="text-[10px] text-zinc-600 flex-shrink-0">{new Date(m.played_at).toLocaleDateString()}</div>
                    </div>
                    <div className="text-xs text-zinc-500 mt-1 font-bold">vs {isWin ? m.loser_name : m.winner_name}</div>
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
