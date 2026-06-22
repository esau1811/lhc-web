'use client';
import { useEffect, useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { Upload, ImageIcon, CheckCircle, AlertCircle, Clock } from 'lucide-react';
import { useLang } from '@/components/LangProvider';

const CARD_BG = '#111114';
const INPUT_STYLE = { background: '#0d0d10', border: '1px solid rgba(255,255,255,0.08)', color: '#fff', outline: 'none' };
const SELECT_STYLE = { ...INPUT_STYLE, appearance: 'none', WebkitAppearance: 'none', cursor: 'pointer' };

export default function TicketsPage() {
  const { t } = useLang();
  const [teams,   setTeams]   = useState([]);
  const [tickets, setTickets] = useState([]);
  const [teamA,   setTeamA]   = useState('');
  const [teamB,   setTeamB]   = useState('');
  const [image,   setImage]   = useState(null);
  const [preview, setPreview] = useState('');
  const [sending, setSending] = useState(false);
  const [status,  setStatus]  = useState('');
  const [error,   setError]   = useState('');
  const fileRef = useRef(null);

  const refresh = () => {
    fetch('/api/community/teams').then(r => r.json()).then(d => setTeams(Array.isArray(d) ? d : []));
    fetch('/api/community/tickets').then(r => r.json()).then(d => setTickets(Array.isArray(d) ? d : []));
  };
  useEffect(refresh, []);

  const handleFile = (file) => { if (!file) return; setImage(file); setPreview(URL.createObjectURL(file)); setError(''); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!teamA || !teamB) { setError(t('c_tickets_err_teams')); return; }
    if (teamA === teamB)  { setError(t('c_tickets_err_diff'));  return; }
    if (!image)           { setError(t('c_tickets_err_img'));   return; }
    setError(''); setSending(true); setStatus('');
    try {
      const fd = new FormData();
      fd.append('team_a_id', teamA); fd.append('team_b_id', teamB); fd.append('image', image);
      const res  = await fetch('/api/community/tickets', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error');
      setStatus(t('c_tickets_success'));
      setTeamA(''); setTeamB(''); setImage(null); setPreview('');
      refresh();
    } catch (e) { setError(e.message); }
    finally { setSending(false); }
  };

  return (
    <div className="space-y-10">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="text-xs font-black uppercase tracking-widest text-zinc-500 mb-2">{t('c_tickets_subtitle')}</div>
        <h1 className="text-5xl md:text-6xl font-black uppercase tracking-tight mb-2 text-white">{t('c_tickets_title')}</h1>
        <p className="text-zinc-400 text-sm">{t('c_tickets_desc')}</p>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Team A */}
          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2 block">{t('c_tickets_your_team')}</label>
            <div className="relative">
              <select value={teamA} onChange={e => setTeamA(e.target.value)} style={SELECT_STYLE} className="w-full rounded-xl px-4 py-3 text-sm"
                onFocus={e => e.target.style.borderColor = 'rgba(6,182,212,0.35)'}
                onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.08)'}>
                <option value="" style={{ background: '#111' }}>{t('c_tickets_select')}</option>
                {teams.map(tm => <option key={tm.id} value={tm.id} style={{ background: '#111' }}>{tm.name}</option>)}
              </select>
              <div className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-zinc-600">▾</div>
            </div>
          </div>
          {/* Team B */}
          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2 block">{t('c_tickets_rival')}</label>
            <div className="relative">
              <select value={teamB} onChange={e => setTeamB(e.target.value)} style={SELECT_STYLE} className="w-full rounded-xl px-4 py-3 text-sm"
                onFocus={e => e.target.style.borderColor = 'rgba(6,182,212,0.35)'}
                onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.08)'}>
                <option value="" style={{ background: '#111' }}>{t('c_tickets_select_rival')}</option>
                {teams.filter(tm => tm.id.toString() !== teamA).map(tm => <option key={tm.id} value={tm.id} style={{ background: '#111' }}>{tm.name}</option>)}
              </select>
              <div className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-zinc-600">▾</div>
            </div>
          </div>
          {/* Drop zone */}
          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2 block">{t('c_tickets_screenshot')}</label>
            <div onClick={() => fileRef.current?.click()}
              onDragOver={e => e.preventDefault()}
              onDrop={e => { e.preventDefault(); handleFile(e.dataTransfer.files[0]); }}
              className="rounded-xl p-8 text-center cursor-pointer transition-all"
              style={{ background: '#0d0d10', border: '2px dashed rgba(255,255,255,0.1)' }}
              onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(6,182,212,0.3)'}
              onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'}>
              {preview ? (
                <div className="space-y-3">
                  <img src={preview} alt="preview" className="max-h-48 mx-auto rounded-xl object-contain" />
                  <div className="text-xs text-zinc-500 font-bold">{image?.name}</div>
                </div>
              ) : (
                <>
                  <ImageIcon size={36} className="mx-auto text-zinc-700 mb-3" />
                  <div className="text-sm text-zinc-400 font-bold">{t('c_tickets_drag')}</div>
                  <div className="text-xs text-zinc-700 mt-1">{t('c_tickets_formats')}</div>
                </>
              )}
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => handleFile(e.target.files[0])} />
            </div>
          </div>

          {error  && <div className="flex items-center gap-2 text-red-400 text-sm rounded-xl px-4 py-3" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}><AlertCircle size={14} />{error}</div>}
          {status && <div className="flex items-center gap-2 text-green-400 text-sm rounded-xl px-4 py-3" style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)' }}><CheckCircle size={14} />{status}</div>}

          <button type="submit" disabled={sending}
            className="flex items-center justify-center gap-2 w-full font-black py-4 rounded-xl transition-all text-sm uppercase tracking-wider disabled:opacity-40"
            style={{ background: 'rgba(6,182,212,0.12)', border: '1px solid rgba(6,182,212,0.3)', color: '#22d3ee' }}>
            <Upload size={16} />{sending ? t('c_tickets_sending') : t('c_tickets_send')}
          </button>
        </form>

        {/* My Tickets */}
        <div>
          <h2 className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-4">{t('c_my_tickets')}</h2>
          <div className="space-y-2">
            {tickets.length === 0 ? (
              <div className="py-12 text-center text-zinc-700 text-sm rounded-xl" style={{ background: CARD_BG, border: '1px solid rgba(255,255,255,0.07)' }}>
                <Clock size={28} className="mx-auto mb-2 opacity-30" />{t('c_no_tickets')}
              </div>
            ) : tickets.map(tk => (
              <div key={tk.id} className="flex items-center gap-3 rounded-xl px-4 py-3" style={{ background: CARD_BG, border: '1px solid rgba(255,255,255,0.07)' }}>
                <span className="text-[10px] font-black px-2 py-1 rounded flex-shrink-0"
                  style={tk.status === 'pending'
                    ? { background: 'rgba(234,179,8,0.12)', color: '#eab308' }
                    : { background: 'rgba(34,197,94,0.12)', color: '#22c55e' }}>
                  {tk.status === 'pending' ? t('c_status_pending') : t('c_status_resolved')}
                </span>
                <div className="flex-1 min-w-0 text-xs font-bold text-zinc-300 truncate">{tk.team_a_name} vs {tk.team_b_name}</div>
                <div className="text-[10px] text-zinc-600 flex-shrink-0">{new Date(tk.created_at).toLocaleDateString()}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
