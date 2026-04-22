'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { useLang } from '@/components/LangProvider';
import Link from 'next/link';

export default function SoundPage() {
  const { data: session, status } = useSession();
  const { t } = useLang();
  
  const audioInputRef = useRef(null);
  const rpfInputRef = useRef(null);

  const [mode, setMode] = useState('weapon'); // 'weapon' | 'kill'
  const [audioFile, setAudioFile] = useState(null);
  const [rpfFile, setRpfFile] = useState(null);
  const [audioDuration, setAudioDuration] = useState(0);
  const [dragOverAudio, setDragOverAudio] = useState(false);
  const [dragOverRpf, setDragOverRpf] = useState(false);
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Audio duration check
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
    const file = e.dataTransfer?.files[0] || e.target?.files[0];
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

  const handleRpfDrop = useCallback((e) => {
    e.preventDefault();
    setDragOverRpf(false);
    const file = e.dataTransfer?.files[0] || e.target?.files[0];
    if (!file) return;

    setError('');
    setSuccess('');

    if (!file.name.toLowerCase().endsWith('.rpf')) {
      setError('Solo se permiten modelos de armas en formato .rpf para reemplazar su sonido.');
      return;
    }
    setRpfFile(file);
  }, []);

  const processKillSound = async () => {
    // Kill sound creates an NUI FiveM script with the MP3 inside
    setIsProcessing(true);
    setError('');
    
    try {
      // Logic for zip packaging would go here (JSZip)
      // Simulating process...
      await new Promise(r => setTimeout(r, 1500));
      setSuccess('Kill sound generado! (Simulación terminada)');
      
      // We would create a Blob with fxmanifest.lua, client.lua, html/index.html and the mp3.
    } catch (err) {
      setError('Error al generar el recurso de Kill Sound.');
    } finally {
      setIsProcessing(false);
    }
  };

  const processWeaponSound = async () => {
    setIsProcessing(true);
    setError('');

    try {
      // Simulating processing
      await new Promise(r => setTimeout(r, 2000));
      setSuccess('Sonido inyectado en el .rpf! (Simulación terminada)');
    } catch (err) {
      setError('Error al inyectar el audio en el archivo .rpf.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleProcess = () => {
    if (mode === 'weapon' && audioFile && rpfFile) processWeaponSound();
    if (mode === 'kill' && audioFile) processKillSound();
  };

  const isReady = (mode === 'kill' && audioFile) || (mode === 'weapon' && audioFile && rpfFile);

  if (status === 'loading') {
    return (
      <>
        <Header showBack title="lhcsound" highlight="sound" />
        <main className="page-container">
          <div className="auth-gate"><div className="spinner" style={{ width: 32, height: 32 }} /></div>
        </main>
      </>
    );
  }

  if (!session) {
    return (
      <>
        <Header showBack title="lhcsound" highlight="sound" />
        <main className="page-container">
          <div className="auth-gate">
            <div style={{ fontSize: 48 }}>🔒</div>
            <h2>{t('login')}</h2>
            <p>Inicia sesión con Discord para usar LHCSound y personalizar tus audios.</p>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <Header showBack title="lhcsound" highlight="sound" />
      <main className="page-container">
        <div className="converter-header">
          <h1>lhc<span>sound</span></h1>
          <p>Reemplaza el sonido de disparo original de un arma, o crea tu propio Kill Sound (max 3 seg).</p>
        </div>

        {/* MODE SELECTOR */}
        <div className="sound-mode-selector">
          <button 
            className={`sound-mode-btn ${mode === 'weapon' ? 'active' : ''}`}
            onClick={() => { setMode('weapon'); setError(''); setSuccess(''); }}
          >
            <span className="mode-icon">🔫</span> Reemplazar Sonido Arma
          </button>
          <button 
            className={`sound-mode-btn ${mode === 'kill' ? 'active' : ''}`}
            onClick={() => { setMode('kill'); setError(''); setSuccess(''); }}
          >
            <span className="mode-icon">💀</span> Crear Script Kill Sound
          </button>
        </div>

        {/* STEP 1: AUDIO */}
        <div className="step-card" id="step-upload-audio">
          <div className="step-label">PASO 1 — SUBIR AUDIO (.MP3 / .WAV)</div>
          
          {!audioFile ? (
            <div
              className={`upload-zone ${dragOverAudio ? 'drag-over' : ''}`}
              onClick={() => audioInputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDragOverAudio(true); }}
              onDragLeave={() => setDragOverAudio(false)}
              onDrop={handleAudioDrop}
            >
              <div className="upload-icon">🎵</div>
              <div className="upload-text">Arrastra tu sonido mp3 o wav</div>
              <div className="upload-subtext">Duración máxima: 3.0 segundos</div>
              <input
                ref={audioInputRef}
                type="file"
                accept=".mp3,.wav"
                className="upload-input"
                onChange={handleAudioDrop}
              />
            </div>
          ) : (
            <div className="file-info">
              <div className="file-icon">🎧</div>
              <div className="file-details">
                <div className="file-name">{audioFile.name}</div>
                <div className="file-size">{(audioFile.size / 1024).toFixed(1)} KB — {audioDuration.toFixed(1)}s</div>
              </div>
              <button className="file-remove" onClick={() => setAudioFile(null)}>✕</button>
            </div>
          )}
        </div>

        {/* STEP 2: RPF (Only for Weapon Mode) */}
        {mode === 'weapon' && (
          <div className="step-card" id="step-upload-rpf">
            <div className="step-label">PASO 2 — SUBIR ARMA (.RPF)</div>
            
            {!rpfFile ? (
              <div
                className={`upload-zone ${dragOverRpf ? 'drag-over' : ''}`}
                onClick={() => rpfInputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setDragOverRpf(true); }}
                onDragLeave={() => setDragOverRpf(false)}
                onDrop={handleRpfDrop}
              >
                <div className="upload-icon">📁</div>
                <div className="upload-text">Sube el archivo .rpf del arma</div>
                <div className="upload-subtext">El sonido de este arma será reemplazado por tu mp3</div>
                <input
                  ref={rpfInputRef}
                  type="file"
                  accept=".rpf"
                  className="upload-input"
                  onChange={handleRpfDrop}
                />
              </div>
            ) : (
              <div className="file-info">
                <div className="file-icon">📄</div>
                <div className="file-details">
                  <div className="file-name">{rpfFile.name}</div>
                  <div className="file-size">{(rpfFile.size / (1024 * 1024)).toFixed(1)} MB</div>
                </div>
                <button className="file-remove" onClick={() => setRpfFile(null)}>✕</button>
              </div>
            )}
          </div>
        )}

        {error && (
          <div className="error-msg" style={{ marginBottom: 20 }}>
            ⚠️ {error}
          </div>
        )}

        {success && (
          <div className="success-msg" style={{ padding: '16px', background: 'rgba(46, 204, 113, 0.1)', color: '#2ecc71', borderRadius: '12px', border: '1px solid rgba(46, 204, 113, 0.2)', marginBottom: '20px', fontWeight: 'bold' }}>
            ✅ {success}
          </div>
        )}

        {/* STEP 3: PROCESS */}
        <div className="step-card" id="step-convert">
          <div className="step-label">
            {mode === 'kill' ? 'PASO 2 — GENERAR RECURSO' : 'PASO 3 — COMBINAR'}
          </div>
          <button
            className={`btn-convert ${isReady ? 'ready' : ''} ${isProcessing ? 'loading' : ''}`}
            onClick={handleProcess}
            disabled={!isReady || isProcessing}
          >
            {isProcessing ? (
              <><span className="spinner" /> PROCESANDO AUDIO...</>
            ) : (
              mode === 'kill' ? 'Generar Script de Kill Sound' : 'Inyectar Sonido en el Arma'
            )}
          </button>
        </div>

      </main>
      <Footer highlight="sound" />
    </>
  );
}
