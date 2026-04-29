'use client';

import { useState, useRef, useCallback } from 'react';
import { useSession, signIn } from 'next-auth/react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { useLang } from '@/components/LangProvider';
import GlassCard from '@/components/GlassCard';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, Music, FileText, Lock, Crosshair, Skull, ShieldAlert, ChevronRight } from 'lucide-react';

export default function SoundPage() {
  const { data: session, status } = useSession();
  const { t } = useLang();
  
  const audioInputRef = useRef(null);
  const rpfInputRef = useRef(null);

  const [mode, setMode] = useState('weapon'); // 'weapon' | 'kill'
  const [audioFile, setAudioFile] = useState(null);
  const [awcFile, setAwcFile] = useState(null);
  const [audioDuration, setAudioDuration] = useState(0);
  const [dragOverAudio, setDragOverAudio] = useState(false);
  const [dragOverAwc, setDragOverAwc] = useState(false);
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const getAudioDuration = (file) => {
    return new Promise((resolve) => {
      const url = URL.createObjectURL(file);
      const audio = new Audio(url);
      audio.onloadedmetadata = () => {
        resolve(audio.duration);
        URL.revokeObjectURL(url);
      };
      audio.onerror = () => {
        resolve(0);
        URL.revokeObjectURL(url);
      };
    });
  };

  const handleAudioDrop = useCallback(async (e) => {
    e.preventDefault();
    setDragOverAudio(false);
    const files = e.dataTransfer?.files || e.target?.files;
    const file = files?.[0];
    if (!file) return;

    setError('');
    setSuccess('');

    if (!file.name.toLowerCase().endsWith('.mp3') && !file.name.toLowerCase().endsWith('.wav')) {
      setError('Solo se permiten archivos de audio .mp3 o .wav');
      return;
    }

    const duration = await getAudioDuration(file);
    
    if (duration > 3.0) {
      setError(`El audio dura ${duration.toFixed(1)}s. El máximo permitido son 3 segundos.`);
      return;
    }

    setAudioFile(file);
    setAudioDuration(duration);
  }, []);

  const handleAwcDrop = useCallback((e) => {
    e.preventDefault();
    setDragOverAwc(false);
    const files = e.dataTransfer?.files || e.target?.files;
    const file = files?.[0];
    if (!file) return;

    setError('');
    setSuccess('');

    if (!file.name.toLowerCase().endsWith('.awc')) {
      setError('Solo se permiten archivos de audio .awc extraídos de OpenIV');
      return;
    }
    setAwcFile(file);
  }, []);

  const VPS_URL = 'https://187.33.157.103.nip.io';

  const handleProcess = async () => {
    setIsProcessing(true);
    setError('');
    setSuccess('');

    try {
      const formData = new FormData();
      formData.append('audio', audioFile);
      formData.append('awc', awcFile);

      const endpoint = `${VPS_URL}/api/Sound/inject`;

      const response = await fetch(endpoint, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(errText || `Error del servidor (${response.status})`);
      }

      const blob = await response.blob();
      const url  = window.URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = 'LHC_Sound_Boost.zip';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      setSuccess('¡Procesado con éxito! Se ha descargado tu .awc modificado. Solo tienes que arrastrarlo de vuelta a OpenIV.');
    } catch (err) {
      setError(err.message || 'Error al procesar el archivo.');
    } finally {
      setIsProcessing(false);
    }
  };

  const isReady = !!audioFile && !!awcFile;

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-red-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-[#050505]">
        <Header />
        <main className="max-w-7xl mx-auto px-6 pt-40 flex flex-col items-center text-center">
          <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mb-6">
            <Lock className="text-zinc-600" size={32} />
          </div>
          <h2 className="text-4xl font-black mb-4 tracking-tight">ACCESO RESTRINGIDO</h2>
          <p className="text-zinc-500 max-w-md mb-8">Debes iniciar sesión con Discord para utilizar LHCSound.</p>
          <button onClick={() => signIn('discord')} className="btn-pill btn-red px-12">
            Login con Discord
          </button>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Header />
      <main className="max-w-4xl mx-auto px-6 pt-32 pb-32">
        
        <div className="mb-12 flex flex-col md:flex-row md:items-center gap-6">
          <img src="/icon_sound.png" alt="Sound" className="w-24 h-24 object-contain ai-icon-blend nitro-glow" />
          <div>
            <h1 className="text-4xl font-black mb-2 tracking-tight uppercase">
              LHC<span className="text-red-500">SOUND</span>
            </h1>
            <p className="text-zinc-500 font-medium max-w-xl">
              {t('soundDesc')}
            </p>
          </div>
        </div>

        {/* MODE SELECTOR */}
        <div className="flex flex-wrap gap-4 mb-12">
          <button 
            onClick={() => { setMode('weapon'); setError(''); setSuccess(''); }}
            className={`btn-pill border flex items-center gap-2 ${
              mode === 'weapon' 
              ? 'bg-red-500/10 border-red-500 text-red-500' 
              : 'bg-white/5 border-white/10 text-zinc-400 hover:text-white'
            }`}
          >
            <Crosshair size={16} /> {t('sound_mode_weapon')}
          </button>
          <button 
            onClick={() => { setMode('kill'); setError(''); setSuccess(''); }}
            className={`btn-pill border flex items-center gap-2 ${
              mode === 'kill' 
              ? 'bg-red-500/10 border-red-500 text-red-500' 
              : 'bg-white/5 border-white/10 text-zinc-400 hover:text-white'
            }`}
          >
            <Skull size={16} /> {t('sound_mode_kill')}
          </button>
        </div>

        <div className="space-y-8">
          
          {/* STEP 1: AUDIO */}
          <GlassCard className="p-8">
            <div className="flex items-center gap-3 mb-6">
              <span className="bg-white/10 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold">1</span>
              <h3 className="font-bold text-zinc-400 text-sm tracking-widest uppercase">{t('sound_step_1')}</h3>
            </div>

            {!audioFile ? (
              <div
                className={`border-2 border-dashed rounded-2xl p-12 transition-all duration-300 flex flex-col items-center justify-center cursor-pointer ${
                  dragOverAudio ? 'border-red-500 bg-red-500/5' : 'border-white/10 hover:border-white/20 hover:bg-white/5'
                }`}
                onClick={() => audioInputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setDragOverAudio(true); }}
                onDragLeave={() => setDragOverAudio(false)}
                onDrop={handleAudioDrop}
              >
                <Music size={40} className="text-zinc-600 mb-4" />
                <p className="font-bold text-lg mb-1">{t('sound_upload_audio')}</p>
                <p className="text-zinc-500 text-sm">{t('sound_duration_hint')}</p>
                <input ref={audioInputRef} type="file" accept=".mp3,.wav" className="hidden" onChange={handleAudioDrop} />
              </div>
            ) : (
              <div className="bg-white/5 rounded-2xl p-6 border border-white/5 flex items-center gap-4">
                <div className="p-3 bg-white/5 rounded-xl"><Music className="text-red-500" /></div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold truncate">{audioFile.name}</p>
                  <p className="text-xs text-zinc-500">{(audioFile.size / 1024).toFixed(1)} KB — {audioDuration.toFixed(1)}s</p>
                </div>
                <button onClick={() => setAudioFile(null)} className="text-zinc-500 hover:text-white p-2">✕</button>
              </div>
            )}
          </GlassCard>



          {/* STEP 2: RPF */}
          <GlassCard className="p-8">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <span className="bg-white/10 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold">2</span>
                <h3 className="font-bold text-zinc-400 text-sm tracking-widest uppercase">{t('sound_step_2')}</h3>
              </div>
            </div>

            {!awcFile ? (
              <div
                className={`border-2 border-dashed rounded-2xl p-12 transition-all duration-300 flex flex-col items-center justify-center cursor-pointer ${
                  dragOverAwc ? 'border-red-500 bg-red-500/5' : 'border-white/10 hover:border-white/20 hover:bg-white/5'
                }`}
                onClick={() => rpfInputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setDragOverAwc(true); }}
                onDragLeave={() => setDragOverAwc(false)}
                onDrop={handleAwcDrop}
              >
                <FileText size={40} className="text-zinc-600 mb-4" />
                <p className="font-bold text-lg mb-1">{t('sound_upload_rpf')}</p>
                <p className="text-zinc-500 text-sm text-center px-4">Sube el archivo .awc (ptl_pistol.awc, etc). <br/><strong>Extráelo usando OpenIV (Export) antes de subirlo.</strong></p>
                <input ref={rpfInputRef} type="file" accept=".awc" className="hidden" onChange={handleAwcDrop} />
              </div>
            ) : (
              <div className="bg-white/5 rounded-2xl p-6 border border-white/5 flex items-center gap-4">
                <div className="p-3 bg-white/5 rounded-xl"><FileText className="text-red-500" /></div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold truncate">{awcFile.name}</p>
                  <p className="text-xs text-zinc-500">{(awcFile.size / 1024).toFixed(1)} KB</p>
                </div>
                <button onClick={() => setAwcFile(null)} className="text-zinc-500 hover:text-white p-2">✕</button>
              </div>
            )}

            <div className="mt-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex gap-3">
              <ShieldAlert className="text-red-500 shrink-0" size={20} />
              <p className="text-xs text-red-500/80 leading-relaxed font-bold">
                IMPORTANTE: Sube el archivo .awc que has extraído de OpenIV. No subas el .rpf entero aquí.
              </p>
            </div>
          </GlassCard>

          {/* STEP 3: PROCESS */}
          <GlassCard className="p-8">
            <div className="flex items-center gap-3 mb-6">
              <span className="bg-white/10 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold">3</span>
              <h3 className="font-bold text-zinc-400 text-sm tracking-widest uppercase">{t('sound_step_3')}</h3>
            </div>
            
            <button
              onClick={handleProcess}
              disabled={!isReady || isProcessing}
              className={`w-full btn-pill py-4 text-lg flex items-center justify-center gap-2 ${
                isReady && !isProcessing ? 'btn-red' : 'bg-white/5 text-zinc-600 cursor-not-allowed border border-white/10'
              }`}
            >
              {isProcessing ? (
                <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <>
                  {mode === 'weapon' ? t('sound_process_weapon') : t('sound_process_kill')}
                  <ChevronRight size={20} />
                </>
              )}
            </button>

            {success && <div className="mt-4 p-4 bg-green-500/10 border border-green-500/20 text-green-500 text-sm font-bold rounded-xl text-center">✓ {success}</div>}
            {error && <div className="mt-4 p-4 bg-red-500/10 border border-red-500/20 text-red-500 text-sm font-bold rounded-xl text-center">⚠️ {error}</div>}
          </GlassCard>

          <div className="p-6 bg-red-500/5 border border-red-500/10 rounded-2xl flex gap-4">
            <ShieldAlert className="text-red-500 shrink-0" />
            <p className="text-xs text-zinc-500 leading-relaxed font-medium">
              Sube tu audio (MP3/WAV) y el archivo .awc que quieres modificar. 
              Recuerda extraer el .awc desde OpenIV antes de subirlo. El sistema lo modificará y te devolverá el archivo listo para arrastrarlo de nuevo a OpenIV.
            </p>
          </div>

        </div>
      </main>
      <Footer />
    </div>
  );
}
