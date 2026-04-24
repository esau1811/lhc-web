'use client';
// Version 1.1.3 - Improved Download Filenames & API Precision

import { useState, useRef, useCallback } from 'react';
import { useSession, signIn } from 'next-auth/react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { useLang } from '@/components/LangProvider';
import { WEAPON_CATEGORIES, detectWeaponFromFilenames, getAllWeapons } from '@/lib/weapons';
import JSZip from 'jszip';
import { extractFilenames, extractFromFilename } from '@/lib/rpfParser';
import GlassCard from '@/components/GlassCard';
import { motion } from 'framer-motion';
import { Upload, FileText, ArrowRight, ShieldAlert, Download, Lock } from 'lucide-react';

export default function ConverterPage() {
  const { data: session, status } = useSession();
  const { t } = useLang();
  const fileInputRef = useRef(null);

  const [files, setFiles] = useState([]);
  const [fileInfo, setFileInfo] = useState(null);
  const [detectedWeapon, setDetectedWeapon] = useState(null);
  const [sourceWeapon, setSourceWeapon] = useState('');
  const [targetWeapon, setTargetWeapon] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [isConverting, setIsConverting] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [dragOver, setDragOver] = useState(false);

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const handleFiles = useCallback(async (selectedFiles) => {
    setError('');
    setSuccessMessage('');
    setDetectedWeapon(null);
    setSourceWeapon('');
    setTargetWeapon('');

    if (!selectedFiles || selectedFiles.length === 0) return;

    const fileArray = Array.from(selectedFiles);
    setFiles(fileArray);
    if (fileArray.length === 1) {
      setFileInfo({
        name: fileArray[0].name,
        size: formatFileSize(fileArray[0].size),
      });
    } else {
      const totalSize = fileArray.reduce((acc, f) => acc + f.size, 0);
      setFileInfo({
        name: `${fileArray.length} archivos sueltos`,
        size: formatFileSize(totalSize),
      });
    }

    setIsUploading(true);
    try {
      let allNames = [];
      if (fileArray.length === 1 && fileArray[0].name.toLowerCase().endsWith('.rpf')) {
        const arrayBuffer = await fileArray[0].arrayBuffer();
        allNames = extractFilenames(new Uint8Array(arrayBuffer));
      } else {
        allNames = fileArray.map(f => f.name);
      }
      
      const filenameHints = fileArray.flatMap(f => extractFromFilename(f.name));
      const allFiles = [...allNames, ...filenameHints];
      console.log('Converter Debug - Archivos detectados:', allFiles);
      
      const detected = detectWeaponFromFilenames(allFiles);
      console.log('Converter Debug - Arma identificada:', detected);

      if (detected) {
        setDetectedWeapon(detected);
        setSourceWeapon(detected.id);
      }
    } catch (err) {
      console.error('Converter Debug - Error:', err);
      setError('Error parsing the internal file');
    } finally {
      setIsUploading(false);
    }
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length > 0) handleFiles(e.dataTransfer.files);
  }, [handleFiles]);

  const handleConvert = async () => {
    if (files.length === 0 || !sourceWeapon || !targetWeapon || isConverting) return;

    setIsConverting(true);
    setError('');
    setSuccessMessage('');

    try {
      const patchBinaryContent = async (buffer, source, target) => {
        const view = new Uint8Array(buffer);
        const sourceStr = source.toLowerCase().replace(/_/g, '');
        const targetStr = target.toLowerCase().replace(/_/g, '');
        
        const sourceArr = new TextEncoder().encode(sourceStr);
        const targetArr = new TextEncoder().encode(targetStr);
        
        let count = 0;
        for (let i = 0; i < view.length - sourceArr.length; i++) {
          let match = true;
          for (let j = 0; j < sourceArr.length; j++) {
            if (view[i + j] !== sourceArr[j]) {
              match = false;
              break;
            }
          }
          
          if (match) {
            for (let j = 0; j < Math.min(targetArr.length, sourceArr.length); j++) {
              view[i + j] = targetArr[j];
            }
            count++;
          }
        }
        return { buffer, count };
      };

      if (files.length === 1 && files[0].name.toLowerCase().endsWith('.rpf')) {
        const formData = new FormData();
        formData.append('file', files[0]);
        formData.append('sourceWeapon', sourceWeapon);
        formData.append('targetWeapon', targetWeapon);
        formData.append('deepPatch', 'true');
        const targetInfo = getAllWeapons().find(w => w.id === targetWeapon);
        const friendlyName = targetInfo ? targetInfo.name : targetWeapon;

        const response = await fetch('https://187.33.157.103.nip.io/api/WeaponConverter/convert', {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
            const errBody = await response.text();
            throw new Error(errBody || response.statusText);
        }

        const count = response.headers.get('X-Replacement-Count') || '0';
        setSuccessMessage(`✓ Conversión completada — ${count} archivos procesados.`);

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${friendlyName}.rpf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      } else {
        const zip = new JSZip();
        
        const targetInfo = getAllWeapons().find(w => w.id === targetWeapon);
        const friendlyName = targetInfo ? targetInfo.name : targetWeapon;

        // ... existing zip logic ...
        // (I'll keep the loop but use friendlyName for the zip file)
        
        // Helper to get the short version of an ID (e.g. w_pi_pistol -> pistol)
        const getShortId = (id) => {
          return id.toLowerCase().replace(/^w_[a-z]{2}_/, '').replace(/_/g, '');
        };

        const sourceShort = getShortId(sourceWeapon);
        const targetShort = getShortId(targetWeapon);
        
        // Deep Patching Logic: We replace multiple variations of the name to catch internal references
        for (const f of files) {
          let parsedName = f.name;
          const lowerName = f.name.toLowerCase();

          // 1. Full Technical ID (w_pi_...)
          const regexFull = new RegExp(sourceWeapon, 'gi');
          parsedName = parsedName.replace(regexFull, targetWeapon);

          // 2. Middle ID (pi_...)
          const sourceMid = sourceWeapon.toLowerCase().replace(/^w_/, '');
          const targetMid = targetWeapon.toLowerCase().replace(/^w_/, '');
          if (parsedName.toLowerCase().includes(sourceMid)) {
             const regexMid = new RegExp(sourceMid, 'gi');
             parsedName = parsedName.replace(regexMid, targetMid);
          }

          // 3. Short ID (pistol) - Only if long enough to be unique
          if (sourceShort.length >= 4 && parsedName.toLowerCase().includes(sourceShort)) {
            const regexShort = new RegExp(sourceShort, 'gi');
            parsedName = parsedName.replace(regexShort, targetShort);
          }

          const originalBuffer = await f.arrayBuffer();
          const { buffer: patchedBuffer, count: binaryPatches } = await patchBinaryContent(originalBuffer, sourceWeapon, targetWeapon);
          
          zip.file(parsedName, patchedBuffer);
        }

        setSuccessMessage(`✓ Conversión completada — Archivos procesados con parcheo binario.`);

        const zipBlob = await zip.generateAsync({ type: 'blob' });
        const url = window.URL.createObjectURL(zipBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${friendlyName}_lhc.zip`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      }
    } catch (err) {
      setError(err.message || 'Error de conexión');
    } finally {
      setIsConverting(false);
    }
  };

  const removeFile = () => {
    setFiles([]);
    setFileInfo(null);
    setDetectedWeapon(null);
    setSourceWeapon('');
    setTargetWeapon('');
    setError('');
    setSuccessMessage('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const isReady = files.length > 0 && sourceWeapon && targetWeapon && !isConverting;

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-yellow-500 border-t-transparent rounded-full animate-spin"></div>
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
          <p className="text-zinc-500 max-w-md mb-8">Debes iniciar sesión con Discord para utilizar el conversor de armas.</p>
          <button onClick={() => signIn('discord')} className="btn-pill btn-gold px-12">
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
          <img src="/converter_icon.png" alt="Converter" className="w-24 h-24 object-contain ai-icon-blend opti-glow" />
          <div>
            <h1 className="text-4xl font-black mb-2 tracking-tight uppercase">
              CONVERSOR DE ARMAS
            </h1>
            <p className="text-zinc-500 font-medium max-w-xl">
              Nuestra herramienta inteligente detecta automáticamente tus archivos y los adapta a cualquier arma de GTA V / FiveM en segundos.
            </p>
          </div>
        </div>

        <div className="space-y-8">
          
          {/* STEP 1 */}
          <GlassCard className="p-8">
            <div className="flex items-center gap-3 mb-6">
              <span className="bg-white/10 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold">1</span>
              <h3 className="font-bold text-zinc-400 text-sm tracking-widest uppercase">SUBIR ARCHIVO</h3>
            </div>

            {!fileInfo ? (
              <div
                className={`border-2 border-dashed rounded-2xl p-12 transition-all duration-300 flex flex-col items-center justify-center cursor-pointer ${
                  dragOver ? 'border-yellow-500 bg-yellow-500/5' : 'border-white/10 hover:border-white/20 hover:bg-white/5'
                }`}
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
              >
                <Upload size={40} className="text-zinc-600 mb-4" />
                <p className="font-bold text-lg mb-1">Arrastra tus archivos aquí</p>
                <p className="text-zinc-500 text-sm">Soporta .RPF, .YTD, .YDR y más</p>
                <input ref={fileInputRef} type="file" multiple className="hidden" onChange={(e) => handleFiles(e.target.files)} />
              </div>
            ) : (
              <div className="bg-white/5 rounded-2xl p-6 border border-white/5 flex items-center gap-4">
                <div className="p-3 bg-white/5 rounded-xl"><FileText className="text-yellow-500" /></div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold truncate">{fileInfo.name}</p>
                  <p className="text-xs text-zinc-500">{fileInfo.size}</p>
                </div>
                <button onClick={removeFile} className="text-zinc-500 hover:text-white p-2">✕</button>
              </div>
            )}
          </GlassCard>

          {/* STEP 2 */}
          <GlassCard className="p-8">
            <div className="flex items-center gap-3 mb-6">
              <span className="bg-white/10 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold">2</span>
              <h3 className="font-bold text-zinc-400 text-sm tracking-widest uppercase">DEFINIR CONVERSIÓN</h3>
            </div>

            <div className="flex flex-col md:flex-row items-center gap-6">
              <div className="flex-1 w-full">
                <label className="text-xs font-bold text-zinc-500 mb-2 block tracking-widest">ORIGEN</label>
                <div className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 font-bold">
                  {detectedWeapon ? (
                    <div className="flex justify-between items-center">
                      <span>{detectedWeapon.name}</span>
                      <span className="text-[10px] bg-yellow-500 text-black px-2 py-0.5 rounded">AUTO</span>
                    </div>
                  ) : (
                    <select 
                      className="bg-transparent w-full outline-none"
                      value={sourceWeapon}
                      onChange={(e) => setSourceWeapon(e.target.value)}
                    >
                      <option value="" disabled className="bg-black">Selecciona arma...</option>
                      {Object.entries(WEAPON_CATEGORIES).map(([id, cat]) => (
                        <optgroup key={id} label={cat.label} className="bg-black">
                          {cat.weapons.map(w => <option key={w.id} value={w.id} className="bg-black">{w.name}</option>)}
                        </optgroup>
                      ))}
                    </select>
                  )}
                </div>
              </div>

              <div className="p-2 bg-white/5 rounded-full text-zinc-600"><ArrowRight /></div>

              <div className="flex-1 w-full">
                <label className="text-xs font-bold text-zinc-500 mb-2 block tracking-widest">DESTINO</label>
                <div className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 font-bold">
                  <select 
                    className="bg-transparent w-full outline-none"
                    value={targetWeapon}
                    onChange={(e) => setTargetWeapon(e.target.value)}
                  >
                    <option value="" disabled className="bg-black">Convertir a...</option>
                    {Object.entries(WEAPON_CATEGORIES).map(([id, cat]) => {
                      // Solo permitir las armas probadas y validadas por el usuario para el destino
                      const allowedIds = [
                        'w_pi_combatpistol', 'w_pi_pistol', 'w_pi_snspistol', 'w_pi_snspistolmk2', 
                        'w_pi_vintage_pistol', 'w_pi_pistolmk2', 'w_sb_smg', 'w_sb_minismg', 
                        'w_sb_microsmg', 'w_pi_appistol', 'w_sb_combatpdw'
                      ];
                      const filteredWeapons = cat.weapons.filter(w => allowedIds.includes(w.id));
                      
                      if (filteredWeapons.length === 0) return null;
                      
                      return (
                        <optgroup key={id} label={cat.label} className="bg-black">
                          {filteredWeapons.map(w => <option key={w.id} value={w.id} className="bg-black">{w.name}</option>)}
                        </optgroup>
                      );
                    })}
                  </select>
                </div>
              </div>
            </div>
          </GlassCard>

          {/* STEP 3 */}
          <GlassCard className="p-8">
            <div className="flex items-center gap-3 mb-6">
              <span className="bg-white/10 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold">3</span>
              <h3 className="font-bold text-zinc-400 text-sm tracking-widest uppercase">EJECUTAR</h3>
            </div>
            
            <button
              onClick={handleConvert}
              disabled={!isReady}
              className={`w-full btn-pill py-4 text-lg ${isReady ? 'btn-gold' : 'bg-white/5 text-zinc-600 cursor-not-allowed border border-white/10'}`}
            >
              {isConverting ? <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin"></div> : 'CONVERTIR Y DESCARGAR'}
            </button>

            {successMessage && <div className="mt-4 p-4 bg-green-500/10 border border-green-500/20 text-green-500 text-sm font-bold rounded-xl">{successMessage}</div>}
            {error && <div className="mt-4 p-4 bg-red-500/10 border border-red-500/20 text-red-500 text-sm font-bold rounded-xl">{error}</div>}
          </GlassCard>

          <div className="p-6 bg-yellow-500/5 border border-yellow-500/10 rounded-2xl flex gap-4">
            <ShieldAlert className="text-yellow-500 shrink-0" />
            <p className="text-xs text-zinc-500 leading-relaxed font-medium">
              Esta herramienta está diseñada para uso educativo y personal en entornos de desarrollo de FiveM. 
              No apoyamos el uso de skins para obtener ventajas competitivas desleales.
            </p>
          </div>

        </div>
      </main>
      <Footer />
    </div>
  );
}
