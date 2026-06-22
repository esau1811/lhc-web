'use client';
import { useEffect, useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { Upload, ImageIcon, CheckCircle, AlertCircle } from 'lucide-react';

export default function TicketsPage() {
  const [teams,    setTeams]    = useState([]);
  const [tickets,  setTickets]  = useState([]);
  const [teamA,    setTeamA]    = useState('');
  const [teamB,    setTeamB]    = useState('');
  const [image,    setImage]    = useState(null);
  const [preview,  setPreview]  = useState('');
  const [sending,  setSending]  = useState(false);
  const [status,   setStatus]   = useState('');
  const [error,    setError]    = useState('');
  const fileRef = useRef(null);

  useEffect(() => {
    fetch('/api/community/teams').then(r => r.json()).then(d => setTeams(Array.isArray(d) ? d : []));
    fetch('/api/community/tickets').then(r => r.json()).then(d => setTickets(Array.isArray(d) ? d : []));
  }, []);

  const handleFile = (file) => {
    if (!file) return;
    setImage(file);
    setPreview(URL.createObjectURL(file));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!teamA || !teamB) { setError('Selecciona los dos equipos'); return; }
    if (teamA === teamB)   { setError('Los equipos deben ser distintos'); return; }
    if (!image)            { setError('Sube una captura de pantalla'); return; }
    setError(''); setSending(true); setStatus('');
    try {
      const fd = new FormData();
      fd.append('team_a_id', teamA);
      fd.append('team_b_id', teamB);
      fd.append('image', image);
      const res = await fetch('/api/community/tickets', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al enviar');
      setStatus('✅ Ticket enviado. Un admin lo revisará pronto.');
      setTeamA(''); setTeamB(''); setImage(null); setPreview('');
      // Refresh ticket list
      fetch('/api/community/tickets').then(r => r.json()).then(d => setTickets(Array.isArray(d) ? d : []));
    } catch (e) {
      setError(e.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-10 max-w-2xl">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="text-xs font-black uppercase tracking-widest text-zinc-500 mb-2">REPORTAR</div>
        <h1 className="text-5xl font-black uppercase tracking-tight mb-2">SUBIR TICKET</h1>
        <p className="text-zinc-500">Sube la captura de pantalla de tu partida. Un administrador la revisará y actualizará los resultados.</p>
      </motion.div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Team A */}
        <div>
          <label className="text-xs font-black uppercase tracking-wider text-zinc-500 mb-2 block">Tu Equipo</label>
          <select value={teamA} onChange={e => setTeamA(e.target.value)}
            className="w-full bg-white/3 border border-white/8 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-cyan-500/40 transition-all appearance-none">
            <option value="" className="bg-[#111]">Selecciona un equipo...</option>
            {teams.map(t => <option key={t.id} value={t.id} className="bg-[#111]">{t.name}</option>)}
          </select>
        </div>

        {/* Team B */}
        <div>
          <label className="text-xs font-black uppercase tracking-wider text-zinc-500 mb-2 block">Equipo Rival</label>
          <select value={teamB} onChange={e => setTeamB(e.target.value)}
            className="w-full bg-white/3 border border-white/8 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-cyan-500/40 transition-all appearance-none">
            <option value="" className="bg-[#111]">Selecciona un equipo...</option>
            {teams.filter(t => t.id.toString() !== teamA).map(t => <option key={t.id} value={t.id} className="bg-[#111]">{t.name}</option>)}
          </select>
        </div>

        {/* Image upload */}
        <div>
          <label className="text-xs font-black uppercase tracking-wider text-zinc-500 mb-2 block">Captura de Pantalla</label>
          <div
            onClick={() => fileRef.current?.click()}
            onDragOver={e => e.preventDefault()}
            onDrop={e => { e.preventDefault(); handleFile(e.dataTransfer.files[0]); }}
            className="border-2 border-dashed border-white/10 rounded-xl p-8 text-center cursor-pointer hover:border-cyan-500/40 hover:bg-cyan-500/5 transition-all">
            {preview ? (
              <img src={preview} alt="preview" className="max-h-48 mx-auto rounded-lg object-contain" />
            ) : (
              <>
                <ImageIcon size={32} className="mx-auto text-zinc-600 mb-3" />
                <div className="text-sm text-zinc-500 font-bold">Arrastra tu imagen aquí o haz clic</div>
                <div className="text-xs text-zinc-700 mt-1">PNG, JPG, WEBP</div>
              </>
            )}
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => handleFile(e.target.files[0])} />
          </div>
        </div>

        {error  && <div className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3"><AlertCircle size={14} />{error}</div>}
        {status && <div className="flex items-center gap-2 text-green-400 text-sm bg-green-500/10 border border-green-500/20 rounded-xl px-4 py-3"><CheckCircle size={14} />{status}</div>}

        <button type="submit" disabled={sending}
          className="flex items-center justify-center gap-2 w-full bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/40 text-cyan-400 font-black py-4 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-wider text-sm">
          <Upload size={16} />
          {sending ? 'Enviando...' : 'Enviar Ticket'}
        </button>
      </form>

      {/* My tickets */}
      {tickets.length > 0 && (
        <div>
          <h2 className="text-sm font-black uppercase tracking-wider text-zinc-400 mb-4">Mis Tickets</h2>
          <div className="space-y-2">
            {tickets.map(t => (
              <div key={t.id} className="flex items-center gap-4 bg-white/3 border border-white/8 rounded-xl px-4 py-3">
                <span className={`text-[10px] font-black px-2 py-1 rounded flex-shrink-0 ${t.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-green-500/20 text-green-400'}`}>
                  {t.status === 'pending' ? 'PENDIENTE' : 'RESUELTO'}
                </span>
                <div className="flex-1 text-xs text-zinc-400 font-bold">{t.team_a_name} vs {t.team_b_name}</div>
                <div className="text-[10px] text-zinc-600">{new Date(t.created_at).toLocaleDateString('es-ES')}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
