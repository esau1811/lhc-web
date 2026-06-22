'use client';
import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ShieldCheck, Plus, Check, X } from 'lucide-react';

function rankTier(elo) {
  if (elo >= 1800) return { name: 'Diamond',  color: '#5eead4' };
  if (elo >= 1600) return { name: 'Platinum', color: '#a78bfa' };
  if (elo >= 1400) return { name: 'Gold',     color: '#fbbf24' };
  if (elo >= 1200) return { name: 'Silver',   color: '#94a3b8' };
  return                  { name: 'Bronze',   color: '#b45309' };
}

export default function AdminPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [tab,     setTab]     = useState('tickets');
  const [tickets, setTickets] = useState([]);
  const [teams,   setTeams]   = useState([]);
  const [resolving, setResolving] = useState(null);
  const [resolve, setResolve] = useState({ winner_team_id: '', loser_team_id: '', winner_kills: '', loser_kills: '', notes: '' });
  const [resStatus, setResStatus] = useState('');
  // Create team form
  const [newTeam, setNewTeam] = useState({ name: '', tag: '', logo_url: '' });
  const [teamStatus, setTeamStatus] = useState('');
  // Register player form
  const [newPlayer, setNewPlayer] = useState({ discord_id: '', discord_name: '', discord_avatar: '', team_id: '' });
  const [playerStatus, setPlayerStatus] = useState('');

  useEffect(() => {
    if (session && !session.user.isAdmin) router.replace('/comunidad');
  }, [session, router]);

  const loadData = () => {
    fetch('/api/community/tickets').then(r => r.json()).then(d => setTickets(Array.isArray(d) ? d : []));
    fetch('/api/community/teams').then(r => r.json()).then(d => setTeams(Array.isArray(d) ? d : []));
  };
  useEffect(loadData, []);

  const handleResolve = async (ticket) => {
    setResolving(ticket.id);
    setResolve({
      winner_team_id: ticket.team_a_id.toString(),
      loser_team_id:  ticket.team_b_id.toString(),
      winner_kills: '', loser_kills: '', notes: ''
    });
    setResStatus('');
  };

  const submitResolve = async () => {
    setResStatus('Procesando...');
    try {
      const res = await fetch('/api/community/admin/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticket_id: resolving, ...resolve, winner_kills: +resolve.winner_kills, loser_kills: +resolve.loser_kills }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error');
      setResStatus('✅ Resuelto correctamente');
      setResolving(null);
      loadData();
    } catch (e) { setResStatus('❌ ' + e.message); }
  };

  const createTeam = async () => {
    if (!newTeam.name) { setTeamStatus('❌ Nombre requerido'); return; }
    setTeamStatus('Creando...');
    const res = await fetch('/api/community/teams', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newTeam) });
    const data = await res.json();
    if (!res.ok) { setTeamStatus('❌ ' + data.error); return; }
    setTeamStatus('✅ Equipo creado: ' + data.name);
    setNewTeam({ name: '', tag: '', logo_url: '' });
    loadData();
  };

  const registerPlayer = async () => {
    if (!newPlayer.discord_id || !newPlayer.discord_name) { setPlayerStatus('❌ Discord ID y nombre requeridos'); return; }
    setPlayerStatus('Registrando...');
    const res = await fetch('/api/community/players', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newPlayer) });
    const data = await res.json();
    if (!res.ok) { setPlayerStatus('❌ ' + data.error); return; }
    setPlayerStatus('✅ Jugador registrado: ' + data.discord_name);
    setNewPlayer({ discord_id: '', discord_name: '', discord_avatar: '', team_id: '' });
  };

  if (!session?.user?.isAdmin) return null;

  const TABS = [
    { id: 'tickets', label: `Tickets Pendientes (${tickets.length})` },
    { id: 'teams',   label: 'Crear Equipo' },
    { id: 'players', label: 'Registrar Jugador' },
  ];

  return (
    <div className="space-y-8">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3">
        <ShieldCheck size={28} className="text-red-500" />
        <div>
          <h1 className="text-4xl font-black uppercase tracking-tight">Panel Admin</h1>
          <p className="text-zinc-500 text-sm">Gestiona tickets, equipos y jugadores.</p>
        </div>
      </motion.div>

      {/* Tabs */}
      <div className="flex gap-2 flex-wrap">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all
              ${tab === t.id ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-white/3 border border-white/8 text-zinc-500 hover:text-white'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── TICKETS ── */}
      {tab === 'tickets' && (
        <div className="space-y-4">
          {tickets.length === 0 ? (
            <div className="py-16 text-center text-zinc-600 bg-white/3 border border-white/8 rounded-xl text-sm">No hay tickets pendientes</div>
          ) : tickets.map(t => (
            <div key={t.id} className="bg-white/3 border border-white/8 rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-xs text-zinc-500 font-bold">Ticket #{t.id} · {new Date(t.created_at).toLocaleString('es-ES')}</div>
                  <div className="font-black text-sm text-white mt-1">{t.team_a_name} vs {t.team_b_name}</div>
                  <div className="text-xs text-zinc-500">Enviado por: {t.submitter_name}</div>
                </div>
                {resolving !== t.id && (
                  <button onClick={() => handleResolve(t)}
                    className="flex items-center gap-2 px-4 py-2 bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/30 text-cyan-400 rounded-lg text-xs font-black transition-all">
                    <Check size={13} /> Resolver
                  </button>
                )}
              </div>

              {t.image_path && (
                <img src={t.image_path} alt="ticket" className="max-h-64 rounded-xl border border-white/10 object-contain" />
              )}

              {resolving === t.id && (
                <div className="border border-white/10 rounded-xl p-4 space-y-3 bg-black/30">
                  <div className="text-xs font-black uppercase tracking-wider text-zinc-400 mb-2">Resolver Partida</div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] text-zinc-500 font-bold uppercase block mb-1">Equipo Ganador</label>
                      <select value={resolve.winner_team_id} onChange={e => setResolve(r => ({ ...r, winner_team_id: e.target.value }))}
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white appearance-none">
                        {teams.map(tm => <option key={tm.id} value={tm.id} className="bg-[#111]">{tm.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] text-zinc-500 font-bold uppercase block mb-1">Equipo Perdedor</label>
                      <select value={resolve.loser_team_id} onChange={e => setResolve(r => ({ ...r, loser_team_id: e.target.value }))}
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white appearance-none">
                        {teams.filter(tm => tm.id.toString() !== resolve.winner_team_id).map(tm => <option key={tm.id} value={tm.id} className="bg-[#111]">{tm.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] text-zinc-500 font-bold uppercase block mb-1">Kills Ganador</label>
                      <input type="number" min="0" value={resolve.winner_kills} onChange={e => setResolve(r => ({ ...r, winner_kills: e.target.value }))}
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white" />
                    </div>
                    <div>
                      <label className="text-[10px] text-zinc-500 font-bold uppercase block mb-1">Kills Perdedor</label>
                      <input type="number" min="0" value={resolve.loser_kills} onChange={e => setResolve(r => ({ ...r, loser_kills: e.target.value }))}
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white" />
                    </div>
                  </div>
                  <input placeholder="Notas opcionales..." value={resolve.notes} onChange={e => setResolve(r => ({ ...r, notes: e.target.value }))}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-zinc-600" />
                  {resStatus && <div className="text-xs font-bold text-zinc-400">{resStatus}</div>}
                  <div className="flex gap-2">
                    <button onClick={submitResolve} className="flex items-center gap-1.5 px-4 py-2 bg-green-500/20 hover:bg-green-500/30 border border-green-500/30 text-green-400 rounded-lg text-xs font-black transition-all">
                      <Check size={13} /> Confirmar
                    </button>
                    <button onClick={() => setResolving(null)} className="flex items-center gap-1.5 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-400 rounded-lg text-xs font-black transition-all">
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
            { label: 'Tag (etiqueta)',       key: 'tag',      placeholder: 'Ej: LR' },
            { label: 'URL del logo',         key: 'logo_url', placeholder: 'https://...' },
          ].map(f => (
            <div key={f.key}>
              <label className="text-xs font-black uppercase tracking-wider text-zinc-500 mb-2 block">{f.label}</label>
              <input value={newTeam[f.key]} onChange={e => setNewTeam(p => ({ ...p, [f.key]: e.target.value }))}
                placeholder={f.placeholder}
                className="w-full bg-white/3 border border-white/8 rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-cyan-500/40 transition-all" />
            </div>
          ))}
          {teamStatus && <div className="text-xs font-bold text-zinc-400">{teamStatus}</div>}
          <button onClick={createTeam}
            className="flex items-center gap-2 px-6 py-3 bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/30 text-cyan-400 rounded-xl text-xs font-black transition-all">
            <Plus size={14} /> Crear Equipo
          </button>
        </div>
      )}

      {/* ── REGISTER PLAYER ── */}
      {tab === 'players' && (
        <div className="max-w-md space-y-4">
          {[
            { label: 'Discord ID *',     key: 'discord_id',     placeholder: '123456789012345678' },
            { label: 'Nombre Discord *', key: 'discord_name',   placeholder: 'nombre#0000' },
            { label: 'URL Avatar',       key: 'discord_avatar', placeholder: 'https://cdn.discordapp.com/...' },
          ].map(f => (
            <div key={f.key}>
              <label className="text-xs font-black uppercase tracking-wider text-zinc-500 mb-2 block">{f.label}</label>
              <input value={newPlayer[f.key]} onChange={e => setNewPlayer(p => ({ ...p, [f.key]: e.target.value }))}
                placeholder={f.placeholder}
                className="w-full bg-white/3 border border-white/8 rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-cyan-500/40 transition-all" />
            </div>
          ))}
          <div>
            <label className="text-xs font-black uppercase tracking-wider text-zinc-500 mb-2 block">Equipo</label>
            <select value={newPlayer.team_id} onChange={e => setNewPlayer(p => ({ ...p, team_id: e.target.value }))}
              className="w-full bg-white/3 border border-white/8 rounded-xl px-4 py-3 text-sm text-white appearance-none focus:outline-none focus:border-cyan-500/40 transition-all">
              <option value="" className="bg-[#111]">Sin equipo</option>
              {teams.map(t => <option key={t.id} value={t.id} className="bg-[#111]">{t.name}</option>)}
            </select>
          </div>
          {playerStatus && <div className="text-xs font-bold text-zinc-400">{playerStatus}</div>}
          <button onClick={registerPlayer}
            className="flex items-center gap-2 px-6 py-3 bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/30 text-cyan-400 rounded-xl text-xs font-black transition-all">
            <Plus size={14} /> Registrar Jugador
          </button>
        </div>
      )}
    </div>
  );
}
