'use client';

import { useState, useRef } from 'react';
import { useSession } from 'next-auth/react';
import Header from '@/components/Header';
import GlassCard from '@/components/GlassCard';
import { Music, FileCode, Zap, ChevronRight, CheckCircle2, LockKeyhole, FileArchive, Target } from 'lucide-react';

const VPS_URL = 'https://187.33.157.103.nip.io';
const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB por trozo para burlar cualquier límite

export default function SoundPage() {
  const { data: session } = useSession();
  
  const audioInputRef = useRef(null);
  const awcInputRef = useRef(null);

  const [audioFile, setAudioFile] = useState(null);
  const [awcFile, setAwcFile] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Firma RPF con Chunks
  const [rpfFile, setRPFFile] = useState(null);
  const [isFixing, setIsFixing] = useState(false);
  const [fixProgress, setFixProgress] = useState(0);
  const [isDragOverRPF, setIsDragOverRPF] = useState(false);

  // Resident RPF modo directo
  const [residentRpf, setResidentRpf] = useState(null);
  const [residentAudio, setResidentAudio] = useState(null);
  const [residentChannel, setResidentChannel] = useState('PTL_PISTOL_SHOT.R');
  const [residentSampleRate, setResidentSampleRate] = useState('32000');
  const [isResidentLoading, setIsResidentLoading] = useState(false);

  const [weaponType, setWeaponType] = useState('pistol');
  const [useTemplate, setUseTemplate] = useState(true);
  const [surgicalName, setSurgicalName] = useState(''); 
  const [sampleRate, setSampleRate] = useState('32000');
  
  const [isDragOverAudio, setIsDragOverAudio] = useState(false);
  const [isDragOverAwc, setIsDragOverAwc] = useState(false);

  const weapons = [
    { id: 'pistol', name: 'Pistola Básica', file: 'ptl_pistol.awc' },
    { id: 'combatpistol', name: 'Pistola de Combate', file: 'ptl_combat.awc' },
    { id: 'smg', name: 'SMG (MP5)', file: 'smg_smg.awc' },
    { id: 'microsmg', name: 'Micro SMG (Uzi)', file: 'smg_micro.awc' },
    { id: 'appistol', name: 'Pistola AP', file: 'ptl_ap.awc' },
    { id: 'killsound', name: 'Kill Sound', file: 'resident.awc' },
  ];

  const handleDragOver = (e, setter) => { e.preventDefault(); setter(true); };
  const handleDragLeave = (e, setter) => { e.preventDefault(); setter(false); };
  const handleDrop = (e, fileSetter, dragOverSetter) => { e.preventDefault(); dragOverSetter(false); const file = e.dataTransfer.files[0]; if (file) fileSetter(file); };

  const handleFixRPF = async () => {
    if (!rpfFile) return;
    setIsFixing(true); setError(null); setSuccess(null); setFixProgress(0);
    try {
      const formData = new FormData();
      formData.append('rpf', rpfFile);
      const response = await fetch(`${VPS_URL}/api/Sound/fix-rpf`, { method: 'POST', body: formData });
      if (!response.ok) {
        let errMsg = 'Error al firmar el RPF';
        try { const j = await response.clone().json(); errMsg = j.error || errMsg; } catch {}
        throw new Error(errMsg);
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = rpfFile.name; document.body.appendChild(a); a.click(); a.remove();
      setSuccess('¡RPF Firmado con éxito!');
    } catch (err) { setError(err.message); } finally { setIsFixing(false); }
  };

  const handleResidentPatch = async () => {
    if (!residentRpf || !residentAudio || !residentChannel) return;
    setIsResidentLoading(true); setError(null); setSuccess(null);
    try {
      const formData = new FormData();
      formData.append('rpf', residentRpf);
      formData.append('audio', residentAudio);
      formData.append('channelName', residentChannel);
      formData.append('sampleRate', residentSampleRate);
      const res = await fetch(`${VPS_URL}/api/Sound/patch-resident`, { method: 'POST', body: formData });
      if (!res.ok) {
        let errMsg = 'Error en el servidor';
        try { const j = await res.clone().json(); errMsg = j.error || errMsg; } catch {}
        throw new Error(errMsg);
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'weapons_patched.awc'; document.body.appendChild(a); a.click(); a.remove();
      setSuccess('¡weapons.awc parcheado! Ahora mételo en resident.rpf con OpenIV y fírmalo.');
    } catch (err) { setError(err.message); } finally { setIsResidentLoading(false); }
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
    <div className="min-h-screen bg-black text-white selection:bg-red-500/30">
      <Header />
      
      <main className="max-w-4xl mx-auto px-4 pt-32 pb-12">
        <div className="mb-16 text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-white to-gray-500 bg-clip-text text-transparent uppercase tracking-tighter">
            LHC Sound <span className="text-red-500 font-mono">Injector</span>
          </h1>
          <p className="text-gray-400 max-w-2xl mx-auto italic">
            Inyecta sonidos en armas de GTA V. Ahora con soporte para archivos gigantes (Chunks).
          </p>
        </div>

        <div className="grid gap-8">
          {/* PASO 1: AUDIO */}
          <GlassCard className="p-8 border-red-500/20 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                <Music size={120} />
            </div>
            <div className="flex items-center gap-4 mb-6 relative z-10">
              <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center text-red-500 font-bold border border-red-500/20 shadow-[0_0_15px_rgba(239,68,68,0.2)]">1</div>
              <h2 className="text-xl font-bold uppercase tracking-wider">Tu Sonido (.MP3 / .WAV)</h2>
            </div>
            <div 
              onClick={() => audioInputRef.current?.click()}
              onDragOver={(e) => handleDragOver(e, setIsDragOverAudio)}
              onDragLeave={(e) => handleDragLeave(e, setIsDragOverAudio)}
              onDrop={(e) => handleDrop(e, setAudioFile, setIsDragOverAudio)}
              className={`border-2 border-dashed rounded-2xl p-10 transition-all cursor-pointer flex flex-col items-center justify-center gap-4 relative z-10
                ${isDragOverAudio ? 'border-red-500 bg-red-500/20' : 'border-white/10 hover:border-red-500/30 hover:bg-white/5'}
                ${audioFile ? 'border-green-500/50 bg-green-500/10' : ''}`}
            >
              <Music className={`w-12 h-12 ${audioFile ? 'text-green-500 animate-pulse' : 'text-gray-500'}`} />
              <p className="text-gray-400 text-center">{audioFile ? audioFile.name : 'Haz clic o arrastra tu audio personalizado'}</p>
              <input type="file" ref={audioInputRef} className="hidden" accept="audio/*" onChange={(e) => setAudioFile(e.target.files[0])} />
            </div>
          </GlassCard>

          {/* PASO 2: BASE */}
          <GlassCard className="p-8 border-red-500/20">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center text-red-500 font-bold border border-red-500/20 shadow-[0_0_15px_rgba(239,68,68,0.2)]">2</div>
              <h2 className="text-xl font-bold uppercase tracking-wider">Base de Arma / Resident</h2>
            </div>
            <div className="flex bg-black/60 p-1 rounded-xl mb-8 border border-white/10">
              <button onClick={() => setUseTemplate(true)} className={`flex-1 py-3 rounded-lg font-bold text-sm uppercase transition-all ${useTemplate ? 'bg-red-600 text-white' : 'text-gray-500'}`}>Plantillas Pro</button>
              <button onClick={() => setUseTemplate(false)} className={`flex-1 py-3 rounded-lg font-bold text-sm uppercase transition-all ${!useTemplate ? 'bg-red-600 text-white' : 'text-gray-500'}`}>Mi .AWC / Resident</button>
            </div>

            {!useTemplate && (
              <div className="mb-8 p-6 bg-red-500/5 border border-red-500/20 rounded-2xl">
                <div className="flex items-center gap-3 mb-2 text-red-500">
                    <Target size={18} />
                    <h3 className="font-bold uppercase text-xs tracking-widest">Modo Quirúrgico (Resident)</h3>
                </div>
                <input type="text" placeholder="Ej: PTL_PISTOL_SHOT.R" value={surgicalName} onChange={(e) => setSurgicalName(e.target.value)} className="w-full bg-black border border-white/10 rounded-xl px-5 py-3 text-sm font-mono focus:border-red-500 outline-none uppercase" />
              </div>
            )}

            {useTemplate ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {weapons.map(w => (
                  <button key={w.id} onClick={() => setWeaponType(w.id)} className={`p-5 rounded-2xl border text-left transition-all relative group ${weaponType === w.id ? 'border-red-500 bg-red-500/10' : 'border-white/5 bg-white/5 text-gray-400'}`}>
                    <div className="flex items-center gap-4">
                        <Zap size={20} className={weaponType === w.id ? 'text-red-500' : 'text-gray-600'} />
                        <div className="font-bold uppercase tracking-tighter text-sm">{w.name}</div>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div 
                onClick={() => awcInputRef.current?.click()}
                onDragOver={(e) => handleDragOver(e, setIsDragOverAwc)}
                onDragLeave={(e) => handleDragLeave(e, setIsDragOverAwc)}
                onDrop={(e) => handleDrop(e, setAwcFile, setIsDragOverAwc)}
                className={`border-2 border-dashed rounded-2xl p-10 transition-all cursor-pointer flex flex-col items-center justify-center gap-4
                  ${isDragOverAwc ? 'border-red-500 bg-red-500/20' : 'border-white/10 hover:border-red-500/30'}
                  ${awcFile ? 'border-green-500/50 bg-green-500/10' : ''}`}
              >
                <FileCode className={`w-12 h-12 ${awcFile ? 'text-green-500' : 'text-gray-500'}`} />
                <p className="text-gray-400 text-center">{awcFile ? awcFile.name : 'Suelta tu weapons.awc o resident.awc'}</p>
                <input type="file" ref={awcInputRef} className="hidden" accept=".awc" onChange={(e) => setAwcFile(e.target.files[0])} />
              </div>
            )}
          </GlassCard>

          {/* PASO 3: AJUSTES */}
          <GlassCard className="p-8 border-red-500/20">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center text-red-500 font-bold border border-red-500/20">3</div>
              <h2 className="text-xl font-bold uppercase tracking-wider">Ajustes</h2>
            </div>
            <div className="grid grid-cols-4 gap-4">
              {['36000', '32000', '24000', '22050'].map(rate => (
                <button key={rate} onClick={() => setSampleRate(rate)} className={`py-3 rounded-xl border font-mono transition-all ${sampleRate === rate ? 'border-red-500 bg-red-500/20' : 'border-white/5 bg-white/5 text-gray-500'}`}>{rate} Hz</button>
              ))}
            </div>
          </GlassCard>

          <button onClick={handleInyectar} disabled={isLoading || !audioFile} className={`w-full py-6 rounded-2xl font-black text-xl uppercase tracking-widest flex items-center justify-center gap-4 transition-all shadow-2xl ${isLoading ? 'bg-gray-800 text-gray-500' : 'bg-red-600 hover:bg-red-700 text-white shadow-red-600/30'}`}>
            {isLoading ? 'Inyectando...' : <>Inyectar Sonido <ChevronRight strokeWidth={3} /></>}
          </button>

          {/* SECCIÓN FIRMAR RPF (MODO CHUNKS + DISEÑO PREMIUM) */}
          <div className="pt-12 mt-4 border-t border-white/5">
            <GlassCard className="p-8 border-yellow-500/10 hover:border-yellow-500/20 transition-colors">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-10 h-10 rounded-full bg-yellow-500/10 flex items-center justify-center text-yellow-500 font-bold border border-yellow-500/20 shadow-[0_0_15px_rgba(234,179,8,0.1)]">
                  <LockKeyhole size={20} />
                </div>
                <h2 className="text-xl font-bold uppercase tracking-wider text-yellow-500">Firmar Archivo .RPF <span className="text-[10px] bg-yellow-500/10 px-2 py-1 rounded ml-2">Modo Chunks</span></h2>
              </div>
              <div 
                onDragOver={(e) => handleDragOver(e, setIsDragOverRPF)}
                onDragLeave={(e) => handleDragLeave(e, setIsDragOverRPF)}
                onDrop={(e) => handleDrop(e, setRPFFile, setIsDragOverRPF)}
                onClick={() => { const i = document.createElement('input'); i.type = 'file'; i.accept = '.rpf'; i.onchange = (e) => setRPFFile(e.target.files[0]); i.click(); }}
                className={`border-2 border-dashed rounded-2xl p-10 transition-all cursor-pointer flex flex-col items-center justify-center gap-4
                  ${isDragOverRPF ? 'border-yellow-500 bg-yellow-500/10' : 'border-white/5 bg-white/5 hover:border-yellow-500/30'}
                  ${rpfFile ? 'border-green-500/50 bg-green-500/10' : ''}`}
              >
                <FileArchive className={`w-12 h-12 ${rpfFile ? 'text-green-500' : 'text-gray-600'}`} />
                <p className="text-gray-400 text-center text-sm">{rpfFile ? rpfFile.name : 'Sube tu .RPF (incluso archivos de 100MB+)'}</p>
              </div>

              {isFixing && (
                <div className="mt-6">
                    <div className="flex justify-between text-[10px] uppercase font-bold text-yellow-500 mb-2">
                        <span>Subiendo trozos...</span>
                        <span>{fixProgress}%</span>
                    </div>
                    <div className="w-full bg-white/5 rounded-full h-1.5 overflow-hidden">
                        <div className="bg-yellow-500 h-full transition-all duration-300" style={{ width: `${fixProgress}%` }}></div>
                    </div>
                </div>
              )}

              <button 
                onClick={handleFixRPF} 
                disabled={isFixing || !rpfFile}
                className={`w-full mt-6 py-4 rounded-xl font-bold uppercase tracking-widest border transition-all ${isFixing ? 'bg-gray-800 text-gray-500 border-white/5' : 'bg-yellow-600/10 text-yellow-500 border-yellow-600/30 hover:bg-yellow-600/20 shadow-lg shadow-yellow-600/10'}`}
              >
                {isFixing ? `Procesando... ${fixProgress}%` : 'Firmar y Descargar RPF'}
              </button>
            </GlassCard>
          </div>

          {error && <div className="p-5 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-500 text-xs font-mono">{error}</div>}
          {success && <div className="p-5 rounded-2xl bg-green-500/10 border border-green-500/20 text-green-500 font-bold uppercase text-center">{success}</div>}
          {/* SECCIÓN RESIDENT RPF */}
          <GlassCard className="mt-6">
            <h2 className="text-xl font-bold uppercase tracking-wider text-purple-400 mb-1">Resident RPF — Modo Directo</h2>
            <p className="text-gray-500 text-xs mb-4">Sube el <span className="text-white font-bold">resident.rpf</span> entero + tu audio. El servidor extrae weapons.awc, parchea el canal y te lo devuelve listo.</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="text-xs text-gray-400 uppercase tracking-wider mb-2 block">1. resident.rpf</label>
                <div onClick={() => document.getElementById('residentRpfInput').click()} className={`cursor-pointer border-2 border-dashed rounded-xl p-4 text-center transition-all ${residentRpf ? 'border-purple-500/50 bg-purple-500/10' : 'border-white/10 hover:border-purple-500/30'}`}>
                  <FileArchive className={`w-8 h-8 mx-auto mb-1 ${residentRpf ? 'text-purple-400' : 'text-gray-500'}`} />
                  <p className="text-xs text-gray-400">{residentRpf ? residentRpf.name : 'resident.rpf (120MB aprox)'}</p>
                  <input id="residentRpfInput" type="file" accept=".rpf" className="hidden" onChange={e => setResidentRpf(e.target.files[0])} />
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-400 uppercase tracking-wider mb-2 block">2. Tu audio nuevo</label>
                <div onClick={() => document.getElementById('residentAudioInput').click()} className={`cursor-pointer border-2 border-dashed rounded-xl p-4 text-center transition-all ${residentAudio ? 'border-green-500/50 bg-green-500/10' : 'border-white/10 hover:border-green-500/30'}`}>
                  <Music className={`w-8 h-8 mx-auto mb-1 ${residentAudio ? 'text-green-400' : 'text-gray-500'}`} />
                  <p className="text-xs text-gray-400">{residentAudio ? residentAudio.name : 'WAV / MP3 / OGG'}</p>
                  <input id="residentAudioInput" type="file" accept="audio/*" className="hidden" onChange={e => setResidentAudio(e.target.files[0])} />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="text-xs text-gray-400 uppercase tracking-wider mb-1 block">3. Nombre del canal</label>
                <input type="text" value={residentChannel} onChange={e => setResidentChannel(e.target.value.toUpperCase())} placeholder="PTL_PISTOL_SHOT.R" className="w-full bg-black border border-white/10 rounded-xl px-4 py-2 text-sm font-mono focus:border-purple-500 outline-none uppercase" />
              </div>
              <div>
                <label className="text-xs text-gray-400 uppercase tracking-wider mb-1 block">Sample Rate</label>
                <select value={residentSampleRate} onChange={e => setResidentSampleRate(e.target.value)} className="w-full bg-black border border-white/10 rounded-xl px-4 py-2 text-sm focus:border-purple-500 outline-none">
                  <option value="22050">22050 Hz</option>
                  <option value="32000">32000 Hz</option>
                  <option value="44100">44100 Hz</option>
                </select>
              </div>
            </div>

            <button onClick={handleResidentPatch} disabled={isResidentLoading || !residentRpf || !residentAudio} className={`w-full py-4 rounded-xl font-bold uppercase tracking-widest border transition-all ${isResidentLoading ? 'bg-gray-800 text-gray-500 border-white/5' : 'bg-purple-600/10 text-purple-400 border-purple-600/30 hover:bg-purple-600/20 shadow-lg shadow-purple-600/10'}`}>
              {isResidentLoading ? 'Procesando...' : 'Parchear Canal en Resident.rpf'}
            </button>
          </GlassCard>
        </div>
      </main>
    </div>
  );
}
