'use client';

import { useState, useRef } from 'react';
import { useSession } from 'next-auth/react';
import Header from '@/components/Header';
import { useLang } from '@/components/LangProvider';
import GlassCard from '@/components/GlassCard';
import { Music, FileCode, Zap, ChevronRight, X, ShieldAlert, CheckCircle2, LockKeyhole, FileArchive, Target } from 'lucide-react';

const VPS_URL = 'https://187.33.157.103.nip.io';

export default function SoundPage() {
  const { data: session } = useSession();
  const { t } = useLang();
  
  const audioInputRef = useRef(null);
  const awcInputRef = useRef(null);

  const [audioFile, setAudioFile] = useState(null);
  const [awcFile, setAwcFile] = useState(null);
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Firma RPF
  const [rpfFile, setRPFFile] = useState(null);
  const [isFixing, setIsFixing] = useState(false);
  const [isDragOverRPF, setIsDragOverRPF] = useState(false);

  const [weaponType, setWeaponType] = useState('pistol');
  const [useTemplate, setUseTemplate] = useState(true);
  const [surgicalName, setSurgicalName] = useState(''); 

  const weapons = [
    { id: 'pistol', name: 'Pistola Básica', file: 'ptl_pistol.awc', desc: 'w_pi_pistol.awc' },
    { id: 'combatpistol', name: 'Pistola de Combate', file: 'ptl_combat.awc', desc: 'w_pi_combatpistol.awc' },
    { id: 'smg', name: 'SMG (MP5)', file: 'smg_smg.awc', desc: 'w_sb_smg.awc' },
    { id: 'microsmg', name: 'Micro SMG (Uzi)', file: 'smg_micro.awc', desc: 'w_sb_microsmg.awc' },
    { id: 'appistol', name: 'Pistola AP', file: 'ptl_ap.awc', desc: 'w_pi_appistol.awc' },
    { id: 'killsound', name: 'Kill Sound', file: 'resident.awc', desc: 'resident.rpf/resident.awc' },
  ];

  const [sampleRate, setSampleRate] = useState('32000');
  const [isDragOverAudio, setIsDragOverAudio] = useState(false);
  const [isDragOverAwc, setIsDragOverAwc] = useState(false);

  const handleDragOver = (e, setter) => {
    e.preventDefault();
    setter(true);
  };

  const handleDragLeave = (e, setter) => {
    e.preventDefault();
    setter(false);
  };

  const handleDrop = (e, fileSetter, dragOverSetter) => {
    e.preventDefault();
    dragOverSetter(false);
    const file = e.dataTransfer.files[0];
    if (file) fileSetter(file);
  };

  const handleInyectar = async () => {
    if (!audioFile || (!useTemplate && !awcFile)) return;
    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const formData = new FormData();
      formData.append('audio', audioFile);
      formData.append('useTemplate', useTemplate ? 'true' : 'false');
      formData.append('weaponType', weaponType);
      formData.append('sampleRate', sampleRate);
      formData.append('surgicalName', surgicalName);
      
      if (!useTemplate && awcFile) {
        formData.append('awc', awcFile);
      }

      const response = await fetch(`${VPS_URL}/api/Sound/assemble-and-inject`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const j = await response.json(); 
        throw new Error(j.error || 'Error en el servidor');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const fileName = surgicalName ? `LHC_Surgical_${surgicalName}.zip` : `LHC_Sound_${weaponType}.zip`;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      
      setSuccess('¡Procesado con éxito! Se ha descargado tu archivo modificado.');
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFixRPF = async () => {
    if (!rpfFile) return;
    setIsFixing(true);
    try {
      const formData = new FormData();
      formData.append('rpf', rpfFile);
      const response = await fetch(`${VPS_URL}/api/Sound/fix-rpf`, { method: 'POST', body: formData });
      if (!response.ok) throw new Error('Error al firmar RPF');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = rpfFile.name;
      a.click();
      setSuccess('RPF Firmado correctamente.');
    } catch (err) { setError(err.message); } finally { setIsFixing(false); }
  };

  return (
    <div className="min-h-screen bg-black text-white selection:bg-red-500/30">
      <Header />
      
      <main className="max-w-4xl mx-auto px-4 py-12">
        <div className="mb-12 text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-white to-gray-500 bg-clip-text text-transparent uppercase tracking-tighter">
            LHC Sound <span className="text-red-500 font-mono">Injector</span>
          </h1>
          <p className="text-gray-400 max-w-2xl mx-auto italic">
            Inyecta sonidos en armas de GTA V. Ahora compatible con Resident (Modo Quirúrgico).
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
                ${isDragOverAudio ? 'border-red-500 bg-red-500/20 scale-[1.02]' : ''}
                ${audioFile ? 'border-green-500/50 bg-green-500/10' : 'border-white/10 hover:border-red-500/30 hover:bg-white/5'}`}
            >
              <Music className={`w-12 h-12 ${audioFile ? 'text-green-500 animate-pulse' : 'text-gray-500'}`} />
              <div className="text-center">
                {audioFile ? (
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="text-green-500 w-5 h-5" />
                    <p className="text-green-400 font-medium">{audioFile.name}</p>
                  </div>
                ) : (
                  <p className="text-gray-400">Haz clic o arrastra tu audio personalizado</p>
                )}
                <p className="text-xs text-gray-600 mt-2 italic">Formatos: MP3, WAV, OGG (32khz recomendado)</p>
              </div>
              <input type="file" ref={audioInputRef} className="hidden" accept="audio/*" onChange={(e) => setAudioFile(e.target.files[0])} />
            </div>
          </GlassCard>

          {/* PASO 2: ARMA */}
          <GlassCard className="p-8 border-red-500/20">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center text-red-500 font-bold border border-red-500/20 shadow-[0_0_15px_rgba(239,68,68,0.2)]">2</div>
              <h2 className="text-xl font-bold uppercase tracking-wider">Base de Arma (.AWC)</h2>
            </div>

            <div className="flex bg-black/60 p-1 rounded-xl mb-8 border border-white/10">
              <button onClick={() => setUseTemplate(true)} className={`flex-1 py-3 rounded-lg font-bold text-sm uppercase tracking-widest transition-all ${useTemplate ? 'bg-red-600 text-white shadow-lg shadow-red-600/30' : 'text-gray-500 hover:text-gray-300'}`}>Plantillas Pro</button>
              <button onClick={() => setUseTemplate(false)} className={`flex-1 py-3 rounded-lg font-bold text-sm uppercase tracking-widest transition-all ${!useTemplate ? 'bg-red-600 text-white shadow-lg shadow-red-600/30' : 'text-gray-500 hover:text-gray-300'}`}>Mi propio .AWC / Resident</button>
            </div>

            {!useTemplate && (
              <div className="mb-8 p-6 bg-red-500/5 border border-red-500/20 rounded-2xl">
                <div className="flex items-center gap-3 mb-4 text-red-500">
                    <Target size={20} />
                    <h3 className="font-bold uppercase text-sm tracking-widest">Modo Quirúrgico (Para Resident)</h3>
                </div>
                <p className="text-xs text-gray-400 mb-4 leading-relaxed">
                    Si vas a parchear un archivo grande (como <span className="text-white">weapons.awc</span>), escribe aquí el nombre del sonido exacto que quieres cambiar. <span className="text-red-400">Si lo dejas vacío, se cambiará todo el archivo.</span>
                </p>
                <input 
                    type="text" 
                    placeholder="Ejemplo: PTL_PISTOL_SHOT.R"
                    value={surgicalName}
                    onChange={(e) => setSurgicalName(e.target.value)}
                    className="w-full bg-black border border-white/10 rounded-xl px-5 py-3 text-sm font-mono focus:border-red-500 outline-none transition-all placeholder:text-gray-700 uppercase"
                />
              </div>
            )}

            {useTemplate ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {weapons.map(w => (
                  <button key={w.id} onClick={() => setWeaponType(w.id)} className={`p-5 rounded-2xl border text-left transition-all relative overflow-hidden group ${weaponType === w.id ? 'border-red-500 bg-red-500/10 ring-1 ring-red-500/50' : 'border-white/5 bg-white/5 text-gray-400 hover:border-white/20'}`}>
                    <div className="flex items-center gap-4">
                        <Zap size={20} className={weaponType === w.id ? 'text-red-500' : 'text-gray-600'} />
                        <div>
                            <div className={`font-bold uppercase tracking-tighter ${weaponType === w.id ? 'text-white' : 'text-gray-400'}`}>{w.name}</div>
                            <div className="text-[10px] font-mono text-gray-600 mt-1 opacity-60">{w.file}</div>
                        </div>
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
                  ${isDragOverAwc ? 'border-red-500 bg-red-500/20 scale-[1.02]' : ''}
                  ${awcFile ? 'border-green-500/50 bg-green-500/10' : 'border-white/10 hover:border-red-500/30 hover:bg-white/5'}`}
              >
                <FileCode className={`w-12 h-12 ${awcFile ? 'text-green-500 animate-bounce' : 'text-gray-500'}`} />
                <div className="text-center">
                  {awcFile ? <p className="text-green-400 font-medium">{awcFile.name}</p> : <p className="text-gray-400">Sube tu archivo .AWC o weapons.awc</p>}
                </div>
                <input type="file" ref={awcInputRef} className="hidden" accept=".awc" onChange={(e) => setAwcFile(e.target.files[0])} />
              </div>
            )}
          </GlassCard>

          {/* PASO 3: CALIBRACIÓN */}
          <GlassCard className="p-8 border-red-500/20">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center text-red-500 font-bold border border-red-500/20 shadow-[0_0_15px_rgba(239,68,68,0.2)]">3</div>
              <h2 className="text-xl font-bold uppercase tracking-wider">Ajustes de Sonido</h2>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {['36000', '32000', '24000', '22050'].map(rate => (
                <button key={rate} onClick={() => setSampleRate(rate)} className={`py-3 rounded-xl border font-mono transition-all ${sampleRate === rate ? 'border-red-500 bg-red-500/20 text-white' : 'border-white/5 bg-white/5 text-gray-500 hover:border-white/20'}`}>
                  {rate} Hz
                </button>
              ))}
            </div>
          </GlassCard>

          <button
            onClick={handleInyectar}
            disabled={isLoading || !audioFile || (!useTemplate && !awcFile)}
            className={`w-full py-6 rounded-2xl font-black text-xl uppercase tracking-[0.2em] flex items-center justify-center gap-4 transition-all
              ${isLoading ? 'bg-gray-800 text-gray-500 cursor-not-allowed' : 'bg-red-600 hover:bg-red-700 hover:shadow-[0_0_30px_rgba(220,38,38,0.4)] text-white shadow-2xl shadow-red-600/30'}`}
          >
            {isLoading ? 'Procesando...' : <>Inyectar Sonido <ChevronRight strokeWidth={3} /></>}
          </button>

          {error && <div className="mt-6 p-5 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-500 text-sm font-mono">{error}</div>}
          {success && <div className="mt-6 p-5 rounded-2xl bg-green-500/10 border border-green-500/20 text-green-500 text-sm font-bold uppercase">{success}</div>}
        </div>
      </main>
      
      <style jsx global>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-4px); }
          75% { transform: translateX(4px); }
        }
        .animate-shake {
          animation: shake 0.2s ease-in-out 0s 2;
        }
      `}</style>
    </div>
  );
}
