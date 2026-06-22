'use client';
import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ShieldCheck, Plus, Check, X, ExternalLink, Server, Film } from 'lucide-react';
import { useLang } from '@/components/LangProvider';
import { useServer } from '@/components/ServerProvider';

const CARD_BG    = '#111114';
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
  const { serverId, serverName } = useServer();

  const [tab,       setTab]       = useState('tickets');
  const [tickets,   setTickets]   = useState([]);
  const [teams,     setTeams]     = useState([]);
  const [players,   setPlayers]   = useState([]);
  const [servers,   setServers]   = useState([]);

  // Ticket resolution state
  const [resolving, setResolving] = useState(null);
  const [resolve,   setResolve]   = useState({ winner_team_id: '', loser_team_id: '', notes: '' });
  const [playerStats, setPlayerStats] = useState({}); // { playerId: { kills, deaths } }
  const [resStatus, setResStatus] = useState('');

  // New team
  const [newTeam,   setNewTeam]   = useState({ name: '', tag: '', logo_url: '', logo_file: null });
  const [teamMsg,   setTeamMsg]   = useState('');

  // New player
  const [newPlayer, setNewPlayer] = useState({ discord_id: '', discord_name: '', discord_avatar: '', team_id: '' });
  const [playerMsg, setPlayerMsg] = useState('');

  // New server
  const [newServer,  setNewServer]  = useState({ name: '', logo_url: '', logo_file: null });
  const [serverMsg,  setServerMsg]  = useState('');

  useEffect(() => { if (session && !session.user.isAdmin) router.replace('/comunidad'); }, [session]);

  const load = () => {
    fetch(`/api/community/tickets`).then(r => r.json()).then(d => setTickets(Array.isArray(d) ? d : []));
    fetch(`/api/community/teams?server_id=${serverId}`).then(r => r.json()).then(d => setTeams(Array.isArray(d) ? d : []));
    fetch(`/api/community/players?server_id=${serverId}`).then(r => r.json()).then(d => setPlayers(Array.isArray(d) ? d : []));
    fetch(`/api/community/servers`).then(r => r.json()).then(d => setServers(Array.isArray(d) ? d : []));
  };
  useEffect(load, [serverId]);

  const startResolve = (tk) => {
    setResolving(tk);
    const initial = {};
    // Pre-populate player stats for players in both teams
    const teamAPlayers = players.filter(p => p.team_id === tk.team_a_id);
    const teamBPlayers = players.filter(p => p.team_id === tk.team_b_id);
    [...teamAPlayers, ...teamBPlayers].forEach(p => { initial[p.id] = { kills: '', deaths: '' }; });
    setPlayerStats(initial);
    setResolve({ winner_team_id: tk.team_a_id.toString(), loser_team_id: tk.team_b_id.toString(), notes: '' });
    setResStatus('');
  };

  const submitResolve = async () => {
    setResStatus('Procesando...');
    try {
      const stats = Object.entries(playerStats).map(([pid, s]) => ({
        player_id: parseInt(pid),
        kills: parseInt(s.kills) || 0,
        deaths: parseInt(s.deaths) || 0,
        team_id: players.find(p => p.id === parseInt(pid))?.team_id,
      }));
      const winner_kills = stats.filter(s => s.team_id === parseInt(resolve.winner_team_id)).reduce((a, s) => a + s.kills, 0);
      const loser_kills  = stats.filter(s => s.team_id === parseInt(resolve.loser_team_id)).reduce((a, s) => a + s.kills, 0);
      const res = await fetch('/api/community/admin/resolve', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticket_id: resolving.id,
          winner_team_id: parseInt(resolve.winner_team_id),
          loser_team_id: parseInt(resolve.loser_team_id),
          winner_kills, loser_kills,
          notes: resolve.notes,
          player_stats: stats,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error');
      setResStatus('✅ Resuelto correctamente');
      setResolving(null);
      load();
    } catch (e) { setResStatus('❌ ' + e.message); }
  };

  const createTeam = async () => {
    if (!newTeam.name) { setTeamMsg('❌ Nombre requerido'); return; }
    setTeamMsg('...');
    const formData = new FormData();
    formData.append('name', newTeam.name);
    formData.append('tag', newTeam.tag);
    if (newTeam.logo_file) formData.append('logo_file', newTeam.logo_file);
    else if (newTeam.logo_url) formData.append('logo_url', newTeam.logo_url);
    formData.append('server_id', serverId);

    const res = await fetch('/api/community/teams', { method: 'POST', body: formData });
    const d = await res.json();
    if (!res.ok) { setTeamMsg('❌ ' + d.error); return; }
    setTeamMsg('✅ ' + d.name); setNewTeam({ name: '', tag: '', logo_url: '', logo_file: null }); load();
  };

  const registerPlayer = async () => {
    if (!newPlayer.discord_id || !newPlayer.discord_name) { setPlayerMsg('❌ ID y Nombre requeridos'); return; }
    setPlayerMsg('...');
    const res = await fetch('/api/community/players', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...newPlayer, server_id: serverId }) });
    const d = await res.json();
    if (!res.ok) { setPlayerMsg('❌ ' + d.error); return; }
    setPlayerMsg('✅ ' + d.discord_name); setNewPlayer({ discord_id: '', discord_name: '', discord_avatar: '', team_id: '' });
  };

  const createServer = async () => {
    if (!newServer.name) { setServerMsg('❌ Nombre requerido'); return; }
    setServerMsg('...');
    const formData = new FormData();
    formData.append('name', newServer.name);
    if (newServer.logo_file) formData.append('logo_file', newServer.logo_file);
    else if (newServer.logo_url) formData.append('logo_url', newServer.logo_url);

    const res = await fetch('/api/community/servers', { method: 'POST', body: formData });
    const d = await res.json();
    if (!res.ok) { setServerMsg('❌ ' + d.error); return; }
    setServerMsg('✅ ' + d.name); setNewServer({ name: '', logo_url: '', logo_file: null }); load();
  };

  if (!session?.user?.isAdmin) return null;

  const TABS = [
    { id: 'tickets', label: `Tickets (${tickets.length})` },
    { id: 'teams',   label: 'Crear Equipo' },
    { id: 'players', label: 'Registrar Jugador' },
    { id: 'servers', label: 'Servidores' },
  ];

  const teamAPlayers = resolving ? players.filter(p => p.team_id === resolving.team_a_id) : [];
  const teamBPlayers = resolving ? players.filter(p => p.team_id === resolving.team_b_id) : [];

  return (
    <div className="space-y-8">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>
          <ShieldCheck size={22} className="text-red-400" />
        </div>
        <div>
          <h1 className="text-4xl font-black uppercase tracking-tight text-white">Panel Admin</h1>
          <p className="text-zinc-500 text-sm">Gestiona tickets, equipos y jugadores — <span className="text-amber-400 font-bold">{serverName}</span></p>
        </div>
      </motion.div>

      {/* Tabs */}
      <div className="flex gap-2 flex-wrap">
        {TABS.map(tb => (
          <button key={tb.id} onClick={() => setTab(tb.id)}
            className="px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all"
            style={tab === tb.id
              ? { background: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid rgba(239,68,68,0.25)' }
              : { background: CARD_BG, color: '#71717a', border: '1px solid rgba(255,255,255,0.07)' }}>
            {tb.label}
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
          ) : tickets.map(tk => (
            <div key={tk.id} className="rounded-xl p-5 space-y-4"
              style={{ background: CARD_BG, border: '1px solid rgba(255,255,255,0.07)' }}>
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <div className="text-[10px] text-zinc-600 font-bold mb-1">
                    Ticket #{tk.id} · {new Date(tk.created_at).toLocaleString('es-ES')}
                  </div>
                  <div className="font-black text-white">{tk.team_a_name} <span className="text-zinc-600">vs</span> {tk.team_b_name}</div>
                  <div className="text-xs text-zinc-500 mt-1">Enviado por: <span className="text-zinc-300">{tk.submitter_name}</span></div>
                </div>
                <div className="flex gap-2 items-center flex-wrap">
                  {tk.clip_url && (
                    <a href={tk.clip_url} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-black transition-all"
                      style={{ background: 'rgba(168,85,247,0.1)', color: '#a855f7', border: '1px solid rgba(168,85,247,0.25)' }}>
                      <Film size={12} /> Ver Clip
                    </a>
                  )}
                  {resolving?.id !== tk.id && (
                    <button onClick={() => startResolve(tk)}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-black transition-all"
                      style={{ background: 'rgba(6,182,212,0.1)', color: '#22d3ee', border: '1px solid rgba(6,182,212,0.25)' }}>
                      <Check size={13} /> Resolver
                    </button>
                  )}
                </div>
              </div>

              {tk.image_path && (
                <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
                  <img src={tk.image_path} alt="Ticket" className="w-full max-h-72 object-contain" style={{ background: '#0d0d10' }} />
                </div>
              )}

              {resolving?.id === tk.id && (
                <div className="rounded-xl p-4 space-y-4" style={{ background: '#0d0d10', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <div className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Resolver Partida</div>

                  {/* Winner / Loser */}
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { label: 'Equipo Ganador', key: 'winner_team_id' },
                      { label: 'Equipo Perdedor', key: 'loser_team_id' },
                    ].map(f => (
                      <div key={f.key}>
                        <label className="text-[10px] text-zinc-600 font-bold uppercase tracking-wider block mb-1">{f.label}</label>
                        <select value={resolve[f.key]}
                          onChange={e => setResolve(r => ({ ...r, [f.key]: e.target.value }))}
                          style={{ ...SELECT_STYLE, background: '#111114' }}
                          className="w-full rounded-lg px-3 py-2 text-xs">
                          {teams.map(tm => <option key={tm.id} value={tm.id} style={{ background: '#111' }}>{tm.name}</option>)}
                        </select>
                      </div>
                    ))}
                  </div>

                  {/* Individual player K/D */}
                  {(teamAPlayers.length > 0 || teamBPlayers.length > 0) && (
                    <div className="space-y-3">
                      <div className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Kills y Muertes por Jugador</div>
                      {[
                        { label: tk.team_a_name, players: teamAPlayers },
                        { label: tk.team_b_name, players: teamBPlayers },
                      ].map(group => (
                        <div key={group.label} className="space-y-2">
                          <div className="text-[10px] font-bold text-zinc-600 uppercase">{group.label}</div>
                          {group.players.map(p => (
                            <div key={p.id} className="flex items-center gap-3">
                              {p.discord_avatar && <img src={p.discord_avatar} className="w-6 h-6 rounded-full flex-shrink-0" />}
                              <span className="text-xs text-zinc-300 flex-1 truncate">{p.discord_name}</span>
                              <div className="flex gap-2">
                                <input type="number" min="0" placeholder="Kills"
                                  value={playerStats[p.id]?.kills || ''}
                                  onChange={e => setPlayerStats(s => ({ ...s, [p.id]: { ...s[p.id], kills: e.target.value } }))}
                                  style={{ ...INPUT_STYLE, background: '#111114', width: 64 }}
                                  className="rounded-lg px-2 py-1 text-xs text-center" />
                                <input type="number" min="0" placeholder="Muertes"
                                  value={playerStats[p.id]?.deaths || ''}
                                  onChange={e => setPlayerStats(s => ({ ...s, [p.id]: { ...s[p.id], deaths: e.target.value } }))}
                                  style={{ ...INPUT_STYLE, background: '#111114', width: 64 }}
                                  className="rounded-lg px-2 py-1 text-xs text-center" />
                              </div>
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  )}

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
          <div className="text-xs text-amber-400 font-bold">Creando en: {serverName}</div>
          {[
            { label: 'Nombre del equipo *', key: 'name',     placeholder: 'Ej: Los Rambos' },
            { label: 'Tag',                 key: 'tag',      placeholder: 'Ej: LR' },
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
          
          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2 block">Logo del Equipo</label>
            <div className="flex gap-2">
              <input type="file" accept="image/*"
                onChange={e => setNewTeam(p => ({ ...p, logo_file: e.target.files[0] }))}
                style={INPUT_STYLE} className="flex-1 rounded-xl px-4 py-2 text-sm text-zinc-400 file:mr-4 file:py-1 file:px-3 file:rounded-full file:border-0 file:text-xs file:font-bold file:bg-cyan-500/10 file:text-cyan-400 hover:file:bg-cyan-500/20" />
            </div>
            <div className="text-center text-[10px] text-zinc-600 font-bold my-2">- O -</div>
            <input value={newTeam.logo_url} placeholder="https://..."
                onChange={e => setNewTeam(p => ({ ...p, logo_url: e.target.value }))}
                style={INPUT_STYLE} className="w-full rounded-xl px-4 py-3 text-sm placeholder-zinc-700"
                onFocus={e => e.target.style.borderColor = 'rgba(6,182,212,0.35)'}
                onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.08)'} />
          </div>
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
          <div className="text-xs text-amber-400 font-bold">Registrando en: {serverName}</div>
          {[
            { label: 'Discord ID *',     key: 'discord_id',     placeholder: '498521626988773386' },
            { label: 'Nombre Discord *', key: 'discord_name',   placeholder: 'usuario#0000' },
            { label: 'URL Avatar',       key: 'discord_avatar', placeholder: 'https://cdn.discordapp.com/...' },
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

      {/* ── SERVERS ── */}
      {tab === 'servers' && (
        <div className="space-y-6">
          {/* Existing servers */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {servers.map(srv => (
              <div key={srv.id} className="flex items-center gap-3 rounded-xl p-4"
                style={{ background: CARD_BG, border: '1px solid rgba(255,255,255,0.07)' }}>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.2)' }}>
                  <Server size={14} className="text-amber-400" />
                </div>
                <div>
                  <div className="text-sm font-black text-white">{srv.name}</div>
                  <div className="text-[10px] text-zinc-600">ID {srv.id}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Create server form */}
          <div className="max-w-md space-y-4">
            <div className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Crear Nuevo Servidor</div>
            {[
              { label: 'Nombre del Servidor *', key: 'name',     placeholder: 'Ej: PAQUITORP' },
            ].map(f => (
              <div key={f.key}>
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2 block">{f.label}</label>
                <input value={newServer[f.key]} placeholder={f.placeholder}
                  onChange={e => setNewServer(p => ({ ...p, [f.key]: e.target.value }))}
                  style={INPUT_STYLE} className="w-full rounded-xl px-4 py-3 text-sm placeholder-zinc-700"
                  onFocus={e => e.target.style.borderColor = 'rgba(251,191,36,0.35)'}
                  onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.08)'} />
              </div>
            ))}
            
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2 block">Logo del Servidor (opcional)</label>
              <div className="flex gap-2">
                <input type="file" accept="image/*"
                  onChange={e => setNewServer(p => ({ ...p, logo_file: e.target.files[0] }))}
                  style={INPUT_STYLE} className="flex-1 rounded-xl px-4 py-2 text-sm text-zinc-400 file:mr-4 file:py-1 file:px-3 file:rounded-full file:border-0 file:text-xs file:font-bold file:bg-amber-500/10 file:text-amber-400 hover:file:bg-amber-500/20" />
              </div>
              <div className="text-center text-[10px] text-zinc-600 font-bold my-2">- O -</div>
              <input value={newServer.logo_url} placeholder="https://..."
                  onChange={e => setNewServer(p => ({ ...p, logo_url: e.target.value }))}
                  style={INPUT_STYLE} className="w-full rounded-xl px-4 py-3 text-sm placeholder-zinc-700"
                  onFocus={e => e.target.style.borderColor = 'rgba(251,191,36,0.35)'}
                  onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.08)'} />
            </div>
            {serverMsg && <div className="text-xs font-bold text-zinc-400">{serverMsg}</div>}
            <button onClick={createServer}
              className="flex items-center gap-2 px-6 py-3 rounded-xl text-xs font-black transition-all"
              style={{ background: 'rgba(251,191,36,0.1)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.25)' }}>
              <Plus size={14} /> Crear Servidor
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
