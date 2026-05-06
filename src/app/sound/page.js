'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import Header from '@/components/Header';
import GlassCard from '@/components/GlassCard';
import { Music, FileCode, Zap, ChevronRight, CheckCircle2, LockKeyhole, FileArchive, Target, Layers } from 'lucide-react';

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

  const [weaponType, setWeaponType] = useState('pistol');
  const [useTemplate, setUseTemplate] = useState(true);
  const [surgicalName, setSurgicalName] = useState('');
  const [sampleRate, setSampleRate] = useState('32000');

  const [isDragOverAudio, setIsDragOverAudio] = useState(false);
  const [isDragOverAwc, setIsDragOverAwc] = useState(false);

  // ── WEAPONS AWC REBUILD ──────────────────────────────────────────────────
  const [awcSoundList, setAwcSoundList]       = useState([]);     // lista del manifest
  const [awcSoundSearch, setAwcSoundSearch]   = useState('');     // filtro búsqueda
  const [awcSelectedSound, setAwcSelectedSound] = useState(null); // { name, sampleRate }
  const [awcAudioFile, setAwcAudioFile]       = useState(null);   // wav del usuario
  const [awcIsLoading, setAwcIsLoading]       = useState(false);
  const [awcProgress, setAwcProgress]         = useState(0);
  const [awcError, setAwcError]               = useState('');
  const [awcSuccess, setAwcSuccess]           = useState('');
  const awcAudioRef = useRef(null);

  // Bloquear drag-to-download del navegador en toda la página
  useEffect(() => {
    const block = e => e.preventDefault();
    document.addEventListener('dragover', block);
    document.addEventListener('drop', block);
    return () => {
      document.removeEventListener('dragover', block);
      document.removeEventListener('drop', block);
    };
  }, []);

  // Cargar lista de sonidos del manifest al montar
  useEffect(() => {
    fetch(`${VPS_URL}/api/Sound/manifest`)
      .then(r => r.json())
      .then(data => { if (data.entries) setAwcSoundList(data.entries); })
      .catch(() => {});
  }, []);

  const handleRebuildAwc = async () => {
    if (!awcAudioFile || !awcSelectedSound) return;
    setAwcIsLoading(true); setAwcError(''); setAwcSuccess(''); setAwcProgress(0);
    try {
      const formData = new FormData();
      formData.append('audio', awcAudioFile);
      formData.append('soundName', awcSelectedSound.name);
      const xhr = new XMLHttpRequest();
      await new Promise((resolve, reject) => {
        xhr.open('POST', `${VPS_URL}/api/Sound/rebuild-awc`);
        xhr.upload.onprogress = e => { if (e.lengthComputable) setAwcProgress(Math.round(e.loaded/e.total*90)); };
        xhr.onload = () => xhr.status < 300 ? resolve(xhr.response) : reject(new Error('Error del servidor'));
        xhr.onerror = () => reject(new Error('Fallo de conexión'));
        xhr.responseType = 'blob';
        xhr.send(formData);
      }).then(blob => {
        setAwcProgress(100);
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = 'weapons_custom.zip';
        document.body.appendChild(a); a.click(); a.remove();
        setAwcSuccess(`✓ weapons.awc generado con "${awcSelectedSound.name}" reemplazado (${awcSelectedSound.sampleRate} Hz)`);
      });
    } catch(err) { setAwcError(err.message); }
    finally { setAwcIsLoading(false); }
  };

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



  const [uploadProgress, setUploadProgress] = useState(0);

  const handleInyectar = async () => {
    if (!audioFile || (!useTemplate && !awcFile)) return;
    setIsLoading(true); setError(null); setSuccess(null); setUploadProgress(0);
    try {
      const isRpf = awcFile && awcFile.name.toLowerCase().endsWith('.rpf');
      // Direct AWC surgical mode: use patch-resident for both .rpf and direct .awc with channel name
      const isSurgicalResident = !useTemplate && awcFile && surgicalName;
      const formData = new FormData();

      if (isSurgicalResident) {
        // Always use patch-resident for surgical mode (handles both .rpf and direct .awc)
        formData.append('rpf', awcFile);
        formData.append('audio', audioFile);
        formData.append('channelName', surgicalName || 'PTL_PISTOL_SHOT.R');
        formData.append('sampleRate', sampleRate);
      } else {
        formData.append('audio', audioFile);
        formData.append('useTemplate', useTemplate ? 'true' : 'false');
        formData.append('weaponType', weaponType);
        formData.append('sampleRate', sampleRate);
        formData.append('surgicalName', surgicalName);
        if (!useTemplate && awcFile) formData.append('awc', awcFile);
      }

      const endpoint = isSurgicalResident
        ? `${VPS_URL}/api/Sound/patch-resident`
        : `${VPS_URL}/api/Sound/assemble-and-inject`;

      const xhr = new XMLHttpRequest();
      const result = await new Promise((resolve, reject) => {
        xhr.open('POST', endpoint);
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            const percent = Math.round((e.loaded / e.total) * 100);
            setUploadProgress(percent);
          }
        };
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) resolve(xhr.response);
          else reject(new Error('Error en el servidor'));
        };
        xhr.onerror = () => reject(new Error('Fallo de conexión'));
        xhr.responseType = 'blob';
        xhr.send(formData);
      });

      const blob = result;
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      const downloadName = isSurgicalResident ? 'weapons_patched.awc' : 'LHC_Sound.zip';
      a.href = url; a.download = downloadName; document.body.appendChild(a); a.click(); a.remove();
      setSuccess(isSurgicalResident ? '¡weapons.awc parcheado! Impórtalo con OpenIV.' : '¡Inyectado!');
    } catch (err) { setError(err.message); } finally { setIsLoading(false); setUploadProgress(0); }
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
              <>
                {/* OpenIV guide for Enhanced edition */}
                <div className="mb-6 p-5 bg-blue-500/5 border border-blue-500/20 rounded-2xl">
                  <div className="flex items-center gap-2 mb-3 text-blue-400">
                    <CheckCircle2 size={15} />
                    <span className="font-bold uppercase text-[10px] tracking-widest">Guía: GTA V Enhanced (v1.0.3788+)</span>
                  </div>
                  <ol className="text-gray-400 text-xs space-y-1.5 list-none">
                    <li className="flex items-center gap-2"><span className="text-blue-500 font-bold">1</span> Abre OpenIV → <span className="font-mono text-gray-300">mods/x64/audio/sfx/RESIDENT.rpf</span></li>
                    <li className="flex items-center gap-2"><span className="text-blue-500 font-bold">2</span> Clic derecho en <span className="font-mono text-gray-300">weapons.awc</span> → <span className="font-mono text-gray-300">Export / Save binary</span></li>
                    <li className="flex items-center gap-2"><span className="text-blue-500 font-bold">3</span> Sube ese <span className="font-mono text-gray-300">weapons.awc</span> aquí abajo junto con tu audio</li>
                    <li className="flex items-center gap-2"><span className="text-blue-500 font-bold">4</span> Descarga el <span className="font-mono text-gray-300">weapons_patched.awc</span> e impórtalo de vuelta con OpenIV</li>
                  </ol>
                </div>
                <div className="mb-8 p-6 bg-red-500/5 border border-red-500/20 rounded-2xl">
                  <div className="flex items-center gap-3 mb-2 text-red-500">
                      <Target size={18} />
                      <h3 className="font-bold uppercase text-xs tracking-widest">Modo Quirúrgico — Canal a reemplazar</h3>
                  </div>
                  <input type="text" placeholder="Ej: PTL_PISTOL_SHOT.R" value={surgicalName} onChange={(e) => setSurgicalName(e.target.value)} className="w-full bg-black border border-white/10 rounded-xl px-5 py-3 text-sm font-mono focus:border-red-500 outline-none uppercase" />
                </div>
              </>
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
                  ${awcFile ? (awcFile.name.endsWith('.rpf') ? 'border-purple-500/50 bg-purple-500/10' : 'border-green-500/50 bg-green-500/10') : ''}`}
              >
                {awcFile?.name.endsWith('.rpf')
                  ? <FileArchive className="w-12 h-12 text-purple-400" />
                  : <FileCode className={`w-12 h-12 ${awcFile ? 'text-green-500' : 'text-gray-500'}`} />}
                <p className="text-gray-400 text-center">
                  {awcFile ? <span className={awcFile.name.endsWith('.rpf') ? 'text-purple-300 font-bold' : 'text-green-300 font-bold'}>{awcFile.name}</span> : 'Sube weapons.awc (exportado de OpenIV)'}
                </p>
                {!awcFile && <span className="text-[10px] text-gray-600 uppercase tracking-widest">También acepta .rpf (Legacy)</span>}
                <input type="file" ref={awcInputRef} className="hidden" accept=".awc,.rpf" onChange={(e) => setAwcFile(e.target.files[0])} />
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

          {isLoading && (
            <div className="mb-4">
              <div className="flex justify-between text-[10px] uppercase font-bold text-red-500 mb-2">
                <span>{uploadProgress < 100 ? `Subiendo archivo...` : `Procesando en el servidor...`}</span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="w-full bg-white/5 rounded-full h-1.5 overflow-hidden">
                <div className="bg-red-600 h-full transition-all duration-300" style={{ width: `${uploadProgress}%` }}></div>
              </div>
            </div>
          )}

          <button onClick={handleInyectar} disabled={isLoading || !audioFile} className={`w-full py-6 rounded-2xl font-black text-xl uppercase tracking-widest flex items-center justify-center gap-4 transition-all shadow-2xl ${isLoading ? 'bg-gray-800 text-gray-500' : 'bg-red-600 hover:bg-red-700 text-white shadow-red-600/30'}`}>
            {isLoading ? (uploadProgress < 100 ? `Subiendo... ${uploadProgress}%` : 'Procesando...') : <>Inyectar Sonido <ChevronRight strokeWidth={3} /></>}
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

          {/* ── SECCIÓN WEAPONS AWC REBUILD ─────────────────────────────── */}
          <div className="pt-12 mt-4 border-t border-white/5">
            <GlassCard className="p-8 border-cyan-500/10 hover:border-cyan-500/20 transition-colors">
              <div className="flex items-center gap-4 mb-2">
                <div className="w-10 h-10 rounded-full bg-cyan-500/10 flex items-center justify-center text-cyan-400 border border-cyan-500/20 shadow-[0_0_15px_rgba(6,182,212,0.1)]">
                  <Layers size={18} />
                </div>
                <div>
                  <h2 className="text-xl font-bold uppercase tracking-wider text-cyan-400">
                    Weapons AWC <span className="text-[10px] bg-cyan-500/10 px-2 py-1 rounded ml-2 normal-case font-normal">RESIDENT.rpf</span>
                  </h2>
                  <p className="text-gray-500 text-xs mt-0.5">Reemplaza cualquier sonido del weapons.awc — Hz se ajustan automáticamente</p>
                </div>
              </div>

              {/* Buscador + dropdown de sonidos */}
              <div className="mt-6 mb-5">
                <label className="text-[10px] uppercase tracking-widest text-gray-500 mb-2 block">
                  1. Busca y selecciona el sonido a reemplazar ({awcSoundList.length} disponibles)
                </label>
                <input
                  type="text"
                  placeholder="Buscar sonido... ej: 156060"
                  value={awcSoundSearch}
                  onChange={e => { setAwcSoundSearch(e.target.value); setAwcSelectedSound(null); }}
                  className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-sm font-mono focus:border-cyan-500 outline-none mb-2"
                />
                {awcSoundSearch.length > 1 && (
                  <div className="max-h-44 overflow-y-auto rounded-xl border border-white/5 bg-black/60 divide-y divide-white/5">
                    {awcSoundList
                      .filter(e => e.name.toLowerCase().includes(awcSoundSearch.toLowerCase()))
                      .slice(0, 30)
                      .map(entry => (
                        <button
                          key={entry.name}
                          onClick={() => { setAwcSelectedSound(entry); setAwcSoundSearch(entry.name); }}
                          className={`w-full text-left px-4 py-2.5 text-xs font-mono flex justify-between items-center hover:bg-cyan-500/10 transition-colors
                            ${awcSelectedSound?.name === entry.name ? 'bg-cyan-500/15 text-cyan-300' : 'text-gray-400'}`}
                        >
                          <span>{entry.name}</span>
                          <span className="text-gray-600">{entry.sampleRate} Hz</span>
                        </button>
                      ))}
                    {awcSoundList.filter(e => e.name.toLowerCase().includes(awcSoundSearch.toLowerCase())).length === 0 && (
                      <p className="text-center text-gray-600 py-4 text-xs">Sin resultados</p>
                    )}
                  </div>
                )}
                {awcSelectedSound && (
                  <div className="mt-2 px-4 py-3 bg-cyan-500/5 border border-cyan-500/20 rounded-xl flex justify-between items-center">
                    <span className="font-mono text-cyan-300 text-sm">{awcSelectedSound.name}</span>
                    <span className="text-[10px] bg-cyan-500/10 text-cyan-400 px-2 py-1 rounded font-bold">{awcSelectedSound.sampleRate} Hz ← automático</span>
                  </div>
                )}
              </div>

              {/* Drop zone audio */}
              <label className="text-[10px] uppercase tracking-widest text-gray-500 mb-2 block">2. Tu audio personalizado (.wav / .mp3)</label>
              <div
                onClick={() => awcAudioRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-8 transition-all cursor-pointer flex flex-col items-center justify-center gap-3 mb-5
                  ${awcAudioFile ? 'border-cyan-500/50 bg-cyan-500/5' : 'border-white/10 hover:border-cyan-500/30 hover:bg-white/5'}`}
              >
                <Music className={`w-10 h-10 ${awcAudioFile ? 'text-cyan-400 animate-pulse' : 'text-gray-600'}`} />
                <p className="text-sm text-gray-400">{awcAudioFile ? <span className="text-cyan-300 font-bold">{awcAudioFile.name}</span> : 'Haz clic o arrastra tu sonido aquí'}</p>
                <input ref={awcAudioRef} type="file" className="hidden" accept="audio/*" onChange={e => setAwcAudioFile(e.target.files[0])} />
              </div>

              {/* Progreso */}
              {awcIsLoading && (
                <div className="mb-4">
                  <div className="flex justify-between text-[10px] uppercase font-bold text-cyan-400 mb-2">
                    <span>{awcProgress < 90 ? 'Subiendo audio...' : 'Reconstruyendo AWC...'}</span>
                    <span>{awcProgress}%</span>
                  </div>
                  <div className="w-full bg-white/5 rounded-full h-1.5 overflow-hidden">
                    <div className="bg-cyan-500 h-full transition-all duration-300" style={{ width: `${awcProgress}%` }} />
                  </div>
                </div>
              )}

              {awcError   && <div className="mb-4 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-mono">{awcError}</div>}
              {awcSuccess && <div className="mb-4 p-4 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-sm font-bold">{awcSuccess}</div>}

              <button
                onClick={handleRebuildAwc}
                disabled={awcIsLoading || !awcAudioFile || !awcSelectedSound}
                className={`w-full py-4 rounded-xl font-bold uppercase tracking-widest border transition-all flex items-center justify-center gap-3
                  ${awcIsLoading || !awcAudioFile || !awcSelectedSound
                    ? 'bg-gray-800/50 text-gray-600 border-white/5 cursor-not-allowed'
                    : 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30 hover:bg-cyan-500/20 shadow-lg shadow-cyan-500/10'}`}
              >
                {awcIsLoading ? `Generando... ${awcProgress}%` : <><Layers size={16} /> Generar weapons.awc <ChevronRight strokeWidth={3} size={16} /></>}
              </button>

              <p className="text-center text-gray-600 text-[10px] mt-4 leading-relaxed">
                El ZIP descargado contiene el <span className="font-mono text-gray-500">weapons.awc</span> listo.<br/>
                Impórtalo con OpenIV en <span className="font-mono text-gray-500">mods/x64/audio/sfx/RESIDENT.rpf</span>
              </p>
            </GlassCard>
          </div>

          {error && <div className="p-5 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-500 text-xs font-mono">{error}</div>}
          {success && <div className="p-5 rounded-2xl bg-green-500/10 border border-green-500/20 text-green-500 font-bold uppercase text-center">{success}</div>}

        </div>
      </main>
    </div>
  );
}
