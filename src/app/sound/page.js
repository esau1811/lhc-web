'use client';

import { useState, useRef } from 'react';
import { useSession } from 'next-auth/react';
import Header from '@/components/Header';
import { useLang } from '@/components/LangProvider';
import GlassCard from '@/components/GlassCard';
import { Music, FileCode, Zap, ChevronRight, X, ShieldAlert } from 'lucide-react';

// LA LLAVE MAESTRA: Dominio con SSL válido y sin límites de Vercel
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

  const [weaponType, setWeaponType] = useState('pistol');
  const [useTemplate, setUseTemplate] = useState(true);

  const weapons = [
    { id: 'pistol', name: 'Pistola', file: 'ptl_pistol.awc' },
    { id: 'combatpistol', name: 'Combat Pistol', file: 'ptl_combat.awc' },
    { id: 'smg', name: 'SMG', file: 'smg_smg.awc' },
    { id: 'microsmg', name: 'Micro SMG', file: 'smg_micro.awc' },
    { id: 'killsound', name: 'Kill Sound', file: 'resident.awc' },
  ];

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
      
      if (!useTemplate && awcFile) {
        formData.append('awc', awcFile);
      }

      // Llamada DIRECTA al VPS para saltarnos el límite de 4MB de Vercel
      const response = await fetch(`${VPS_URL}/api/Sound/assemble-and-inject`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        let errMsg;
        try { const j = await response.json(); errMsg = j.error || JSON.stringify(j); }
        catch { errMsg = await response.text(); }
        throw new Error(errMsg || 'Error en el servidor');
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

  return (
    <div className="min-h-screen bg-black text-white selection:bg-red-500/30">
      <Header />
      
      <main className="max-w-4xl mx-auto px-4 py-12">
        <div className="mb-12 text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-white to-gray-500 bg-clip-text text-transparent">
            AWC Audio Injector <span className="text-red-500 text-2xl font-mono ml-2">v2.0</span>
          </h1>
          <p className="text-gray-400 max-w-2xl mx-auto">
            Inyecta sonidos personalizados en tus armas de GTA V de forma automática y segura.
          </p>
        </div>

        <div className="grid gap-8">
          {/* PASO 1: AUDIO */}
          <GlassCard className="p-8 border-red-500/20">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center text-red-500 font-bold">1</div>
              <h2 className="text-xl font-bold uppercase tracking-wider">Paso 1 — Tu Sonido (.MP3 / .WAV)</h2>
            </div>
            
            <div 
              onClick={() => audioInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-12 transition-all cursor-pointer flex flex-col items-center justify-center gap-4
                ${audioFile ? 'border-green-500/50 bg-green-500/5' : 'border-white/10 hover:border-red-500/30 hover:bg-white/5'}`}
            >
              <Music className={`w-12 h-12 ${audioFile ? 'text-green-500' : 'text-gray-500'}`} />
              <div className="text-center">
                {audioFile ? (
                  <p className="text-green-400 font-medium">{audioFile.name}</p>
                ) : (
                  <p className="text-gray-400">Haz clic para subir tu audio personalizado</p>
                )}
                <p className="text-xs text-gray-600 mt-2">Formatos aceptados: MP3, WAV, OGG</p>
              </div>
              <input 
                type="file" 
                ref={audioInputRef} 
                className="hidden" 
                accept="audio/*" 
                onChange={(e) => setAudioFile(e.target.files[0])} 
              />
            </div>
          </GlassCard>

          {/* PASO 2: ARMA */}
          <GlassCard className="p-8 border-red-500/20">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center text-red-500 font-bold">2</div>
              <h2 className="text-xl font-bold uppercase tracking-wider">Paso 2 — Seleccionar Arma o Subir .AWC</h2>
            </div>

            <div className="flex bg-black/40 p-1 rounded-xl mb-8 border border-white/5">
              <button 
                onClick={() => setUseTemplate(true)}
                className={`flex-1 py-3 rounded-lg font-medium transition-all ${useTemplate ? 'bg-red-600 text-white shadow-lg shadow-red-600/20' : 'text-gray-500 hover:text-gray-300'}`}
              >
                Usar Plantilla (Recomendado)
              </button>
              <button 
                onClick={() => setUseTemplate(false)}
                className={`flex-1 py-3 rounded-lg font-medium transition-all ${!useTemplate ? 'bg-red-600 text-white shadow-lg shadow-red-600/20' : 'text-gray-500 hover:text-gray-300'}`}
              >
                Subir mi propio .AWC
              </button>
            </div>

            {useTemplate ? (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {weapons.map(w => (
                  <button
                    key={w.id}
                    onClick={() => setWeaponType(w.id)}
                    className={`p-4 rounded-xl border text-sm font-medium transition-all flex flex-col items-center gap-3
                      ${weaponType === w.id ? 'border-red-500 bg-red-500/10 text-white' : 'border-white/5 bg-white/5 text-gray-400 hover:border-white/20'}`}
                  >
                    <Zap className={weaponType === w.id ? 'text-red-500' : 'text-gray-600'} />
                    {w.name}
                  </button>
                ))}
              </div>
            ) : (
              <div 
                onClick={() => awcInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-12 transition-all cursor-pointer flex flex-col items-center justify-center gap-4
                  ${awcFile ? 'border-green-500/50 bg-green-500/5' : 'border-white/10 hover:border-red-500/30 hover:bg-white/5'}`}
              >
                <FileCode className={`w-12 h-12 ${awcFile ? 'text-green-500' : 'text-gray-500'}`} />
                <div className="text-center">
                  {awcFile ? (
                    <p className="text-green-400 font-medium">{awcFile.name}</p>
                  ) : (
                    <p className="text-gray-400">Arrastra aquí tu archivo .AWC extraído de OpenIV</p>
                  )}
                  <p className="text-xs text-gray-600 mt-2">Debe ser un archivo extraído con OpenIV (Header: TADA)</p>
                </div>
                <input 
                  type="file" 
                  ref={awcInputRef} 
                  className="hidden" 
                  accept=".awc" 
                  onChange={(e) => setAwcFile(e.target.files[0])} 
                />
              </div>
            )}
          </GlassCard>

          {/* PASO 3: EJECUTAR */}
          <div className="mt-4">
            <button
              onClick={handleInyectar}
              disabled={isLoading || !audioFile || (!useTemplate && !awcFile)}
              className={`w-full py-6 rounded-2xl font-bold text-xl uppercase tracking-widest flex items-center justify-center gap-4 transition-all
                ${isLoading ? 'bg-gray-800 text-gray-500 cursor-not-allowed' : 'bg-red-600 hover:bg-red-700 hover:scale-[1.01] active:scale-[0.99] text-white shadow-2xl shadow-red-600/30'}`}
            >
              {isLoading ? (
                <>
                  <div className="w-6 h-6 border-4 border-white/20 border-t-white rounded-full animate-spin"></div>
                  Procesando...
                </>
              ) : (
                <>
                  Inyectar Sonido en el Arma
                  <ChevronRight />
                </>
              )}
            </button>

            {error && (
              <div className="mt-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-sm flex items-center gap-3 animate-shake">
                <ShieldAlert className="shrink-0" />
                {error}
              </div>
            )}

            {success && (
              <div className="mt-6 p-4 rounded-xl bg-green-500/10 border border-green-500/20 text-green-500 text-sm flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                {success}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
