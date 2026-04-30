'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { useSession, signIn } from 'next-auth/react';
import Header from '@/components/Header';
import { useLang } from '@/components/LangProvider';
import GlassCard from '@/components/GlassCard';
import { Music, FileCode, Lock, Zap, Skull, ShieldAlert, ChevronRight, X } from 'lucide-react';

const VPS_URL = 'https://187.33.157.103:5000';

export default function SoundPage() {
  const { data: session, status } = useSession();
  const { t } = useLang();
  
  const audioInputRef = useRef(null);
  const awcInputRef = useRef(null);

  const [audioFile, setAudioFile] = useState(null);
  const [awcFile, setAwcFile] = useState(null);
  const [dragOverAudio, setDragOverAudio] = useState(false);
  const [dragOverAwc, setDragOverAwc] = useState(false);
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [weaponType, setWeaponType] = useState('pistol');
  const [useTemplate, setUseTemplate] = useState(true);

  const weapons = [
    { id: 'pistol', name: 'Pistola', file: 'ptl_pistol.awc' },
    { id: 'combatpistol', name: 'Combat Pistol', file: 'ptl_combat.awc' },
    { id: 'smg', name: 'SMG', file: 'smg_smg.awc' },
    { id: 'microsmg', name: 'Micro SMG', file: 'smg_micro.awc' },
    { id: 'killsound', name: 'Kill Sound', file: 'resident.awc' },
  ];

  const handleAudioDrop = (e) => {
    e.preventDefault();
    const files = e.dataTransfer?.files || e.target?.files;
    if (files?.[0]) setAudioFile(files[0]);
  };

  const handleAwcDrop = (e) => {
    e.preventDefault();
    const files = e.dataTransfer?.files || e.target?.files;
    if (files?.[0]) setAwcFile(files[0]);
  };

  const handleInyectar = async () => {
    if (!audioFile || (!useTemplate && !awcFile)) return;
    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const formData = new FormData();
      formData.append('audio', audioFile);
      if (useTemplate) {
        formData.append('weaponType', weaponType);
        formData.append('useTemplate', 'true');
      } else {
        formData.append('awc', awcFile);
      }

      const endpoint = `${VPS_URL}/api/Sound/inject`;
      const response = await fetch(endpoint, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(errText || 'Error en el servidor');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `LHC_Sound_${weaponType}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      
      setSuccess('¡Procesado con éxito! Se ha descargado tu sonido inyectado.');
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const isReady = !!audioFile && (useTemplate || !!awcFile);

  if (status === 'loading') return null;

  if (!session) {
    return (
      <div className="min-h-screen bg-[#050505]">
        <Header />
        <main className="max-w-7xl mx-auto px-6 pt-40 flex flex-col items-center text-center">
          <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mb-6">
            <Lock className="text-zinc-600" size={32} />
          </div>
          <h2 className="text-4xl font-black mb-4 tracking-tight uppercase">ACCESO RESTRINGIDO</h2>
          <p className="text-zinc-500 max-w-md mb-8">Debes iniciar sesión con Discord para utilizar LHCSound.</p>
          <button onClick={() => signIn('discord')} className="bg-red-600 px-12 py-4 rounded-full font-bold hover:bg-red-500 transition-all">
            Login con Discord
          </button>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white font-sans selection:bg-red-500/30">
      <Header />
      
      <div className="fixed inset-0 overflow-hidden pointer-events-none opacity-20">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-red-600 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-red-900 rounded-full blur-[120px]" />
      </div>

      <div className="relative z-10 max-w-5xl mx-auto px-6 pt-32 pb-20">
        <div className="text-center mb-16">
          <h1 className="text-6xl font-black tracking-tighter mb-4 italic uppercase">
            LHC <span className="text-red-600">SOUND</span>
          </h1>
          <p className="text-gray-400 max-w-2xl mx-auto">
            Personaliza los sonidos de tus armas y efectos de kill en FiveM de forma instantánea. 
            Sin programas externos, directo a tu juego.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-8">
          {/* STEP 1: AUDIO */}
          <GlassCard className="p-8 rounded-3xl relative overflow-hidden group border border-white/5">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-10 h-10 rounded-full bg-red-600/10 border border-red-600/20 flex items-center justify-center text-red-500 font-bold">1</div>
              <h2 className="text-xl font-bold uppercase tracking-wider">Paso 1 — Subir Audio (.MP3 / .WAV)</h2>
            </div>
            
            <div 
              onDragOver={(e) => { e.preventDefault(); setDragOverAudio(true); }}
              onDragLeave={() => setDragOverAudio(false)}
              onDrop={(e) => { handleAudioDrop(e); setDragOverAudio(false); }}
              className={`border-2 border-dashed rounded-2xl p-10 text-center transition-all cursor-pointer ${
                dragOverAudio ? 'border-red-600 bg-red-600/5' : 'border-white/10 hover:border-white/20'
              }`}
              onClick={() => audioInputRef.current?.click()}
            >
              <input 
                type="file" 
                ref={audioInputRef} 
                onChange={handleAudioDrop} 
                className="hidden" 
                accept="audio/*"
              />
              {audioFile ? (
                <div className="flex items-center justify-between bg-white/5 p-4 rounded-xl border border-white/10">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-lg bg-red-600/20 flex items-center justify-center text-red-500">
                      <Music size={24} />
                    </div>
                    <div className="text-left">
                      <p className="font-bold truncate max-w-[200px]">{audioFile.name}</p>
                      <p className="text-xs text-gray-500">{(audioFile.size / 1024).toFixed(1)} KB</p>
                    </div>
                  </div>
                  <button onClick={(e) => { e.stopPropagation(); setAudioFile(null); }} className="text-gray-500 hover:text-white transition-colors">
                    <X size={20} />
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mx-auto text-gray-500 group-hover:text-red-500 transition-colors">
                    <Music size={32} />
                  </div>
                  <p className="text-gray-400">Arrastra tu sonido mp3 o wav</p>
                </div>
              )}
            </div>
          </GlassCard>

          {/* STEP 2: WEAPON / AWC */}
          <GlassCard className="p-8 rounded-3xl relative overflow-hidden group border border-white/5">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-10 h-10 rounded-full bg-red-600/10 border border-red-600/20 flex items-center justify-center text-red-500 font-bold">2</div>
              <h2 className="text-xl font-bold uppercase tracking-wider">Paso 2 — Seleccionar Arma o Subir .AWC</h2>
            </div>

            <div className="flex gap-4 mb-8 p-1 bg-black rounded-xl border border-white/5">
              <button 
                onClick={() => setUseTemplate(true)}
                className={`flex-1 py-3 px-6 rounded-lg font-bold transition-all ${useTemplate ? 'bg-red-600 text-white shadow-lg' : 'text-gray-500 hover:text-gray-300'}`}
              >
                Usar Plantilla (Recomendado)
              </button>
              <button 
                onClick={() => setUseTemplate(false)}
                className={`flex-1 py-3 px-6 rounded-lg font-bold transition-all ${!useTemplate ? 'bg-red-600 text-white shadow-lg' : 'text-gray-500 hover:text-gray-300'}`}
              >
                Subir mi propio .AWC
              </button>
            </div>

            {useTemplate ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
                {weapons.map((w) => (
                  <button
                    key={w.id}
                    onClick={() => setWeaponType(w.id)}
                    className={`p-4 rounded-2xl border transition-all text-center group ${
                      weaponType === w.id 
                        ? 'border-red-600 bg-red-600/10 text-white shadow-lg shadow-red-600/10' 
                        : 'border-white/5 bg-white/5 text-gray-500 hover:border-white/20 hover:text-gray-300'
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-lg mx-auto mb-3 flex items-center justify-center transition-colors ${weaponType === w.id ? 'bg-red-600 text-white' : 'bg-white/5 group-hover:bg-white/10'}`}>
                      {w.id === 'killsound' ? <Skull size={20} /> : <Zap size={20} />}
                    </div>
                    <span className="text-xs font-bold uppercase block">{w.name}</span>
                  </button>
                ))}
              </div>
            ) : (
              <div 
                onDragOver={(e) => { e.preventDefault(); setDragOverAwc(true); }}
                onDragLeave={() => setDragOverAwc(false)}
                onDrop={(e) => { handleAwcDrop(e); setDragOverAwc(false); }}
                className={`border-2 border-dashed rounded-2xl p-10 text-center transition-all cursor-pointer ${
                  dragOverAwc ? 'border-red-600 bg-red-600/5' : 'border-white/10 hover:border-white/20'
                }`}
                onClick={() => awcInputRef.current?.click()}
              >
                <input 
                  type="file" 
                  ref={awcInputRef} 
                  onChange={handleAwcDrop} 
                  className="hidden" 
                  accept=".awc"
                />
                {awcFile ? (
                  <div className="flex items-center justify-between bg-white/5 p-4 rounded-xl border border-white/10">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-lg bg-red-600/20 flex items-center justify-center text-red-500">
                        <FileCode size={24} />
                      </div>
                      <div className="text-left">
                        <p className="font-bold truncate max-w-[200px]">{awcFile.name}</p>
                        <p className="text-xs text-gray-500">{(awcFile.size / 1024).toFixed(1)} KB</p>
                      </div>
                    </div>
                    <button onClick={(e) => { e.stopPropagation(); setAwcFile(null); }} className="text-gray-500 hover:text-white transition-colors">
                      <X size={20} />
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mx-auto text-gray-500 group-hover:text-red-500 transition-colors">
                      <FileCode size={32} />
                    </div>
                    <p className="text-gray-400">Sube el archivo .awc del arma</p>
                    <p className="text-[10px] text-gray-600 uppercase tracking-widest">Extráelo usando OpenIV (Export) antes de subirlo</p>
                  </div>
                )}
              </div>
            )}
          </GlassCard>

          {/* STEP 3: ACTION */}
          <GlassCard className="p-8 rounded-3xl relative overflow-hidden group border border-white/5">
            <div className="flex items-center gap-4 mb-8">
              <div className="w-10 h-10 rounded-full bg-red-600/10 border border-red-600/20 flex items-center justify-center text-red-500 font-bold">3</div>
              <h2 className="text-xl font-bold uppercase tracking-wider">Paso 3 — Ejecutar</h2>
            </div>

            <button
              onClick={handleInyectar}
              disabled={!isReady || isLoading}
              className={`w-full py-6 rounded-2xl font-black text-xl uppercase tracking-tighter transition-all flex items-center justify-center gap-3 ${
                isReady && !isLoading
                  ? 'bg-red-600 hover:bg-red-500 hover:scale-[1.02] active:scale-[0.98] shadow-xl shadow-red-600/20 text-white'
                  : 'bg-white/5 text-gray-700 cursor-not-allowed border border-white/5'
              }`}
            >
              {isLoading ? (
                <>
                  <div className="w-6 h-6 border-4 border-white/20 border-t-white rounded-full animate-spin" />
                  <span>Procesando...</span>
                </>
              ) : (
                <>
                  <span>Inyectar Sonido en el Arma</span>
                  <ChevronRight size={24} />
                </>
              )}
            </button>

            {success && <div className="mt-4 p-4 bg-green-500/10 border border-green-500/20 text-green-500 text-sm font-bold rounded-xl text-center">✓ {success}</div>}
            {error && <div className="mt-4 p-4 bg-red-500/10 border border-red-500/20 text-red-500 text-sm font-bold rounded-xl text-center">⚠️ {error}</div>}
            {!isReady && !isLoading && <div className="mt-4 text-center text-xs text-gray-600 uppercase tracking-widest flex items-center justify-center gap-2">
              <ShieldAlert size={12} />
              <span>Faltan archivos para continuar</span>
            </div>}
          </GlassCard>
        </div>
      </div>
    </div>
  );
}
