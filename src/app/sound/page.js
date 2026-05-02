'use client';

import { useState, useRef } from 'react';
import { useSession } from 'next-auth/react';
import Header from '@/components/Header';
import GlassCard from '@/components/GlassCard';
import { Music, FileCode, Zap, ChevronRight, CheckCircle2, LockKeyhole, FileArchive, Target } from 'lucide-react';

const VPS_URL = 'https://187.33.157.103.nip.io';
const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB por trozo

export default function SoundPage() {
  const audioInputRef = useRef(null);
  const awcInputRef = useRef(null);

  const [audioFile, setAudioFile] = useState(null);
  const [awcFile, setAwcFile] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  const [rpfFile, setRPFFile] = useState(null);
  const [isFixing, setIsFixing] = useState(false);
  const [fixProgress, setFixProgress] = useState(0);

  const [weaponType, setWeaponType] = useState('pistol');
  const [useTemplate, setUseTemplate] = useState(true);
  const [surgicalName, setSurgicalName] = useState(''); 
  const [sampleRate, setSampleRate] = useState('32000');

  const weapons = [
    { id: 'pistol', name: 'Pistola Básica', file: 'ptl_pistol.awc' },
    { id: 'combatpistol', name: 'Pistola de Combate', file: 'ptl_combat.awc' },
    { id: 'smg', name: 'SMG (MP5)', file: 'smg_smg.awc' },
    { id: 'microsmg', name: 'Micro SMG (Uzi)', file: 'smg_micro.awc' },
    { id: 'killsound', name: 'Kill Sound', file: 'resident.awc' },
  ];

  const handleFixRPF = async () => {
    if (!rpfFile) return;
    setIsFixing(true); setError(null); setSuccess(null); setFixProgress(0);
    
    try {
      const uploadId = Date.now().toString();
      const totalChunks = Math.ceil(rpfFile.size / CHUNK_SIZE);
      
      // Enviar trozos uno a uno
      for (let i = 0; i < totalChunks; i++) {
        const start = i * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, rpfFile.size);
        const chunk = rpfFile.slice(start, end);
        
        const formData = new FormData();
        formData.append('chunk', chunk);
        formData.append('uploadId', uploadId);
        formData.append('index', i);
        
        await fetch(`${VPS_URL}/api/Sound/upload-chunk`, { method: 'POST', body: formData });
        setFixProgress(Math.round(((i + 1) / totalChunks) * 100));
      }

      // Avisar al servidor para unir y firmar
      const response = await fetch(`${VPS_URL}/api/Sound/assemble-and-fix-rpf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uploadId, total: totalChunks, fileName: rpfFile.name })
      });

      if (!response.ok) throw new Error('Error al procesar el RPF');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `Fixed_${rpfFile.name}`; a.click();
      setSuccess('¡RPF Firmado con éxito!');
    } catch (err) { setError(err.message); } finally { setIsFixing(false); }
  };

  const handleInyectar = async () => {
    if (!audioFile || (!useTemplate && !awcFile)) return;
    setIsLoading(true); setError(null);
    try {
      const formData = new FormData();
      formData.append('audio', audioFile);
      formData.append('useTemplate', useTemplate ? 'true' : 'false');
      formData.append('weaponType', weaponType);
      formData.append('sampleRate', sampleRate);
      formData.append('surgicalName', surgicalName);
      if (!useTemplate && awcFile) formData.append('awc', awcFile);

      const res = await fetch(`${VPS_URL}/api/Sound/assemble-and-inject`, { method: 'POST', body: formData });
      if (!res.ok) throw new Error('Error en el servidor');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `LHC_Sound.zip`; a.click();
      setSuccess('¡Inyectado con éxito!');
    } catch (err) { setError(err.message); } finally { setIsLoading(false); }
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <Header />
      <main className="max-w-4xl mx-auto px-4 pt-32 pb-12">
        <h1 className="text-4xl font-bold mb-12 text-center uppercase tracking-tighter">LHC Sound <span className="text-red-500">Injector</span></h1>

        <div className="grid gap-8">
          {/* SECCIONES DE INYECCIÓN (Iguales que antes) */}
          <GlassCard className="p-8 border-red-500/20">
            <h2 className="text-xl font-bold mb-6 uppercase flex items-center gap-4"><div className="w-8 h-8 rounded-full bg-red-500/10 flex items-center justify-center text-red-500 text-xs border border-red-500/20">1</div> Tu Audio</h2>
            <input type="file" accept="audio/*" onChange={(e) => setAudioFile(e.target.files[0])} className="w-full bg-white/5 p-4 rounded-xl border border-white/10" />
          </GlassCard>

          <GlassCard className="p-8 border-red-500/20">
            <h2 className="text-xl font-bold mb-6 uppercase flex items-center gap-4"><div className="w-8 h-8 rounded-full bg-red-500/10 flex items-center justify-center text-red-500 text-xs border border-red-500/20">2</div> Base / Resident</h2>
            <div className="flex bg-black/60 p-1 rounded-xl mb-4 border border-white/10">
              <button onClick={() => setUseTemplate(true)} className={`flex-1 py-3 rounded-lg text-sm uppercase ${useTemplate ? 'bg-red-600' : 'text-gray-500'}`}>Plantillas</button>
              <button onClick={() => setUseTemplate(false)} className={`flex-1 py-3 rounded-lg text-sm uppercase ${!useTemplate ? 'bg-red-600' : 'text-gray-500'}`}>Mi .AWC / Resident</button>
            </div>
            {!useTemplate && (
                <input type="text" placeholder="Ej: PTL_PISTOL_SHOT.R" value={surgicalName} onChange={(e) => setSurgicalName(e.target.value)} className="w-full bg-black border border-white/10 rounded-xl px-4 py-2 text-sm uppercase mb-4" />
            )}
            {useTemplate ? (
              <div className="grid grid-cols-2 gap-4">{weapons.map(w => (<button key={w.id} onClick={() => setWeaponType(w.id)} className={`p-4 rounded-xl border text-xs uppercase ${weaponType === w.id ? 'border-red-500 bg-red-500/10' : 'border-white/5 bg-white/5 text-gray-500'}`}>{w.name}</button>))}</div>
            ) : (
              <input type="file" accept=".awc" onChange={(e) => setAwcFile(e.target.files[0])} className="w-full bg-white/5 p-4 rounded-xl border border-white/10" />
            )}
          </GlassCard>

          <button onClick={handleInyectar} disabled={isLoading} className="w-full py-6 rounded-2xl bg-red-600 font-bold uppercase text-xl shadow-xl shadow-red-600/20">{isLoading ? 'Inyectando...' : 'Inyectar Sonido'}</button>

          {/* SECCIÓN REPARACIÓN RPF (CON CHUNKS) */}
          <div className="mt-12 pt-12 border-t border-white/5">
            <GlassCard className="p-8 border-yellow-500/10">
              <h2 className="text-xl font-bold mb-6 uppercase flex items-center gap-4 text-yellow-500"><LockKeyhole size={20} /> Firmar Archivo .RPF (Modo Chunks)</h2>
              <input type="file" accept=".rpf" onChange={(e) => setRPFFile(e.target.files[0])} className="w-full bg-white/5 p-4 rounded-xl border border-white/10 mb-6" />
              
              {isFixing && (
                <div className="w-full bg-white/5 rounded-full h-2 mb-6 overflow-hidden">
                    <div className="bg-yellow-500 h-full transition-all duration-300" style={{ width: `${fixProgress}%` }}></div>
                </div>
              )}

              <button 
                onClick={handleFixRPF} 
                disabled={isFixing || !rpfFile}
                className="w-full py-4 rounded-xl bg-yellow-600/20 text-yellow-500 border border-yellow-500/30 font-bold uppercase tracking-widest hover:bg-yellow-600/30"
              >
                {isFixing ? `Subiendo... ${fixProgress}%` : 'Firmar y Descargar RPF'}
              </button>
            </GlassCard>
          </div>

          {error && <div className="p-4 bg-red-500/10 text-red-500 rounded-xl text-xs font-mono">{error}</div>}
          {success && <div className="p-4 bg-green-500/10 text-green-500 rounded-xl font-bold uppercase">{success}</div>}
        </div>
      </main>
    </div>
  );
}
