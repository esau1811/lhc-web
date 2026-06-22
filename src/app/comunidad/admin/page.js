'use client';
import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ShieldCheck, Plus, Check, X } from 'lucide-react';
import { useLang } from '@/components/LangProvider';

const CARD_BG    = '#111114';
const CARD_HOVER = '#16161a';
const INPUT_STYLE = {
  background: '#0d0d10',
  border: '1px solid rgba(255,255,255,0.08)',
  color: '#fff',
  outline: 'none',
};
const SELECT_STYLE = { ...INPUT_STYLE, appearance: 'none', WebkitAppearance: 'none' };

export default function AdminPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const { t } = useLang();
  const [tab,       setTab]       = useState('tickets');
  const [tickets,   setTickets]   = useState([]);
  const [teams,     setTeams]     = useState([]);
  const [resolving, setResolving] = useState(null);
  const [resolve,   setResolve]   = useState({ winner_team_id: '', loser_team_id: '', winner_kills: '', loser_kills: '', notes: '' });
  const [resStatus, setResStatus] = useState('');
  const [newTeam,   setNewTeam]   = useState({ name: '', tag: '', logo_url: '' });
  const [teamMsg,   setTeamMsg]   = useState('');
  const [newPlayer, setNewPlayer] = useState({ discord_id: '', discord_name: '', discord_avatar: '', team_id: '' });
  const [playerMsg, setPlayerMsg] = useState('');

  useEffect(() => { if (session && !session.user.isAdmin) router.replace('/comunidad'); }, [session]);

  const load = () => {
    fetch('/api/community/tickets').then(r => r.json()).then(d => setTickets(Array.isArray(d) ? d : []));
    fetch('/api/community/teams').then(r => r.json()).then(d => setTeams(Array.isArray(d) ? d : []));
  };
  useEffect(load, []);

  const startResolve = (tk) => {
    setResolving(tk.id);
    setResolve({ winner_team_id: tk.team_a_id.toString(), loser_team_id: tk.team_b_id.toString(), winner_kills: '', loser_kills: '', notes: '' });
    setResStatus('');
  };

  const submitResolve = async () => {
    setResStatus(t('c_processing'));
    try {
      const res = await fetch('/api/community/admin/resolve', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticket_id: resolving, ...resolve, winner_kills: +resolve.winner_kills, loser_kills: +resolve.loser_kills }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error');
      setResStatus('✅ ' + t('c_status_resolved'));
      setResolving(null); load();
    } catch (e) { setResStatus('❌ ' + e.message); }
  };

  const createTeam = async () => {
    if (!newTeam.name) { setTeamMsg('❌ ' + t('c_admin_team_name')); return; }
    setTeamMsg('...');
    const res = await fetch('/api/community/teams', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newTeam) });
    const d = await res.json();
    if (!res.ok) { setTeamMsg('❌ ' + d.error); return; }
    setTeamMsg('✅ ' + d.name); setNewTeam({ name: '', tag: '', logo_url: '' }); load();
  };

  const registerPlayer = async () => {
    if (!newPlayer.discord_id || !newPlayer.discord_name) { setPlayerMsg('❌ ' + t('c_admin_discord_id') + ' + ' + t('c_admin_discord_name')); return; }
    setPlayerMsg('...');
    const res = await fetch('/api/community/players', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newPlayer) });
    const d = await res.json();
    if (!res.ok) { setPlayerMsg('❌ ' + d.error); return; }
    setPlayerMsg('✅ ' + d.discord_name); setNewPlayer({ discord_id: '', discord_name: '', discord_avatar: '', team_id: '' });
  };

  if (!session?.user?.isAdmin) return null;

  const TABS = [
    { id: 'tickets', label: t('c_admin_tickets') + ` (${tickets.length})` },
    { id: 'teams',   label: t('c_admin_create_team') },
    { id: 'players', label: t('c_admin_reg_player') },
  ];

  return (
    <div className="space-y-8">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>
          <ShieldCheck size={22} className="text-red-400" />
        </div>
        <div>
          <h1 className="text-4xl font-black uppercase tracking-tight text-white">Panel Admin</h1>
          <p className="text-zinc-500 text-sm">Gestiona tickets, equipos y jugadores.</p>
        </div>
      </motion.div>

      {/* Tabs */}
      <div className="flex gap-2 flex-wrap">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className="px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all"
            style={tab === t.id
              ? { background: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid rgba(239,68,68,0.25)' }
              : { background: CARD_BG, color: '#71717a', border: '1px solid rgba(255,255,255,0.07)' }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── TICKETS ── */}
      {tab === 'tickets' && (
        <div className="space-y-4">
          {tickets.length === 0 ? (
            <div className="py-20 text-center text-zinc-600 text-sm rounded-xl"
              style={{ background: CARD_BG, border: '1px solid rgba(255,255,255,0.07)' }}>
              No hay tickets pendientes
            </div>
          ) : tickets.map(t => (
            <div key={t.id} className="rounded-xl p-5 space-y-4"
              style={{ background: CARD_BG, border: '1px solid rgba(255,255,255,0.07)' }}>
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <div className="text-[10px] text-zinc-600 font-bold mb-1">
                    Ticket #{t.id} · {new Date(t.created_at).toLocaleString('es-ES')}
                  </div>
                  <div className="font-black text-white">{t.team_a_name} <span className="text-zinc-600">vs</span> {t.team_b_name}</div>
                  <div className="text-xs text-zinc-500 mt-1">Enviado por: <span className="text-zinc-300">{t.submitter_name}</span></div>
                </div>
                {resolving !== t.id && (
                  <button onClick={() => startResolve(t)}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-black transition-all"
                    style={{ background: 'rgba(6,182,212,0.1)', color: '#22d3ee', border: '1px solid rgba(6,182,212,0.25)' }}>
                    <Check size={13} /> Resolver
                  </button>
                )}
              </div>

              {t.image_path && (
                <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
                  <img src={t.image_path} alt="Ticket" className="w-full max-h-72 object-contain" style={{ background: '#0d0d10' }} />
                </div>
              )}

              {resolving === t.id && (
                <div className="rounded-xl p-4 space-y-3" style={{ background: '#0d0d10', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <div className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-3">Resolver Partida</div>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { label: 'Equipo Ganador', key: 'winner_team_id', select: true },
                      { label: 'Equipo Perdedor', key: 'loser_team_id', select: true },
                      { label: 'Kills Ganador', key: 'winner_kills', type: 'number' },
                      { label: 'Kills Perdedor', key: 'loser_kills', type: 'number' },
                    ].map(f => (
                      <div key={f.key}>
                        <label className="text-[10px] text-zinc-600 font-bold uppercase tracking-wider block mb-1">{f.label}</label>
                        {f.select ? (
                          <select value={resolve[f.key]}
                            onChange={e => setResolve(r => ({ ...r, [f.key]: e.target.value }))}
                            style={{ ...SELECT_STYLE, background: '#111114' }}
                            className="w-full rounded-lg px-3 py-2 text-xs">
                            {teams.map(tm => <option key={tm.id} value={tm.id} style={{ background: '#111' }}>{tm.name}</option>)}
                          </select>
                        ) : (
                          <input type={f.type || 'text'} min="0"
                            value={resolve[f.key]}
                            onChange={e => setResolve(r => ({ ...r, [f.key]: e.target.value }))}
                            style={{ ...INPUT_STYLE, background: '#111114' }}
                            className="w-full rounded-lg px-3 py-2 text-xs" />
                        )}
                      </div>
                    ))}
                  </div>
                  <input placeholder="Notas opcionales..."
                    value={resolve.notes}
                    onChange={e => setResolve(r => ({ ...r, notes: e.target.value }))}
                    style={{ ...INPUT_STYLE, background: '#111114' }}
                    className="w-full rounded-lg px-3 py-2 text-xs placeholder-zinc-700" />
                  {resStatus && <div className="text-xs text-zinc-400 font-bold">{resStatus}</div>}
                  <div className="flex gap-2">
                    <button onClick={submitResolve}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-black transition-all"
                      style={{ background: 'rgba(34,197,94,0.1)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.25)' }}>
                      <Check size={13} /> Confirmar
                    </button>
                    <button onClick={() => setResolving(null)}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-black transition-all"
                      style={{ background: 'rgba(255,255,255,0.05)', color: '#71717a', border: '1px solid rgba(255,255,255,0.08)' }}>
                      <X size={13} /> Cancelar
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── CREATE TEAM ── */}
      {tab === 'teams' && (
        <div className="max-w-md space-y-4">
          {[
            { label: 'Nombre del equipo *', key: 'name',     placeholder: 'Ej: Los Rambos' },
            { label: 'Tag',                 key: 'tag',      placeholder: 'Ej: LR' },
            { label: 'URL del logo',        key: 'logo_url', placeholder: 'https://...' },
          ].map(f => (
            <div key={f.key}>
              <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2 block">{f.label}</label>
              <input value={newTeam[f.key]} placeholder={f.placeholder}
                onChange={e => setNewTeam(p => ({ ...p, [f.key]: e.target.value }))}
                style={INPUT_STYLE} className="w-full rounded-xl px-4 py-3 text-sm placeholder-zinc-700"
                onFocus={e => e.target.style.borderColor = 'rgba(6,182,212,0.35)'}
                onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.08)'} />
            </div>
          ))}
          {teamMsg && <div className="text-xs font-bold text-zinc-400">{teamMsg}</div>}
          <button onClick={createTeam}
            className="flex items-center gap-2 px-6 py-3 rounded-xl text-xs font-black transition-all"
            style={{ background: 'rgba(6,182,212,0.1)', color: '#22d3ee', border: '1px solid rgba(6,182,212,0.25)' }}>
            <Plus size={14} /> Crear Equipo
          </button>
        </div>
      )}

      {/* ── REGISTER PLAYER ── */}
      {tab === 'players' && (
        <div className="max-w-md space-y-4">
          {[
            { label: 'Discord ID *',      key: 'discord_id',     placeholder: '123456789012345678' },
            { label: 'Nombre Discord *',  key: 'discord_name',   placeholder: 'usuario#0000' },
            { label: 'URL Avatar',        key: 'discord_avatar', placeholder: 'https://cdn.discordapp.com/...' },
          ].map(f => (
            <div key={f.key}>
              <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2 block">{f.label}</label>
              <input value={newPlayer[f.key]} placeholder={f.placeholder}
                onChange={e => setNewPlayer(p => ({ ...p, [f.key]: e.target.value }))}
                style={INPUT_STYLE} className="w-full rounded-xl px-4 py-3 text-sm placeholder-zinc-700"
                onFocus={e => e.target.style.borderColor = 'rgba(6,182,212,0.35)'}
                onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.08)'} />
            </div>
          ))}
          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2 block">Equipo</label>
            <div className="relative">
              <select value={newPlayer.team_id} onChange={e => setNewPlayer(p => ({ ...p, team_id: e.target.value }))}
                style={{ ...SELECT_STYLE }} className="w-full rounded-xl px-4 py-3 text-sm"
                onFocus={e => e.target.style.borderColor = 'rgba(6,182,212,0.35)'}
                onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.08)'}>
                <option value="" style={{ background: '#111' }}>Sin equipo</option>
                {teams.map(t => <option key={t.id} value={t.id} style={{ background: '#111' }}>{t.name}</option>)}
              </select>
              <div className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-zinc-600">▾</div>
            </div>
          </div>
          {playerMsg && <div className="text-xs font-bold text-zinc-400">{playerMsg}</div>}
          <button onClick={registerPlayer}
            className="flex items-center gap-2 px-6 py-3 rounded-xl text-xs font-black transition-all"
            style={{ background: 'rgba(6,182,212,0.1)', color: '#22d3ee', border: '1px solid rgba(6,182,212,0.25)' }}>
            <Plus size={14} /> Registrar Jugador
          </button>
        </div>
      )}
    </div>
  );
}
