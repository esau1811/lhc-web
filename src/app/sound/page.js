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
  
  const [rpfFile, setRPFFile] = useState(null);
  const [isFixing, setIsFixing] = useState(false);

  const [weaponType, setWeaponType] = useState('pistol');
  const [useTemplate, setUseTemplate] = useState(true);
  const [surgicalName, setSurgicalName] = useState(''); 

  const weapons = [
    { id: 'pistol', name: 'Pistola Básica', file: 'ptl_pistol.awc' },
    { id: 'combatpistol', name: 'Pistola de Combate', file: 'ptl_combat.awc' },
    { id: 'smg', name: 'SMG (MP5)', file: 'smg_smg.awc' },
    { id: 'microsmg', name: 'Micro SMG (Uzi)', file: 'smg_micro.awc' },
    { id: 'killsound', name: 'Kill Sound', file: 'resident.awc' },
  ];

  const [sampleRate, setSampleRate] = useState('32000');

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
      
      if (!useTemplate && awcFile) formData.append('awc', awcFile);

      const response = await fetch(`${VPS_URL}/api/Sound/assemble-and-inject`, { method: 'POST', body: formData });
      if (!response.ok) throw new Error('Error en servidor');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = surgicalName ? `Surgical_${surgicalName}.zip` : `LHC_Sound_${weaponType}.zip`;
      a.click();
      setSuccess('¡Procesado con éxito!');
    } catch (err) { setError(err.message); } finally { setIsLoading(false); }
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <Header />
      <main className="max-w-4xl mx-auto px-4 py-12">
        <h1 className="text-4xl font-bold mb-8 text-center uppercase tracking-tighter">
          LHC Sound <span className="text-red-500">Injector</span>
        </h1>

        <div className="grid gap-8">
          <GlassCard className="p-8 border-red-500/20">
            <h2 className="text-xl font-bold mb-6 uppercase flex items-center gap-4">
              <span className="w-8 h-8 rounded-full bg-red-500 flex items-center justify-center text-xs">1</span>
              Tu Audio (.MP3 / .WAV)
            </h2>
            <input type="file" accept="audio/*" onChange={(e) => setAudioFile(e.target.files[0])} className="w-full bg-white/5 p-4 rounded-xl border border-white/10" />
            {audioFile && <p className="mt-2 text-green-500 text-sm">✓ {audioFile.name}</p>}
          </GlassCard>

          <GlassCard className="p-8 border-red-500/20">
            <h2 className="text-xl font-bold mb-6 uppercase flex items-center gap-4">
              <span className="w-8 h-8 rounded-full bg-red-500 flex items-center justify-center text-xs">2</span>
              Base de Arma / Resident
            </h2>
            <div className="flex bg-black/60 p-1 rounded-xl mb-6 border border-white/10">
              <button onClick={() => setUseTemplate(true)} className={`flex-1 py-3 rounded-lg font-bold text-sm uppercase ${useTemplate ? 'bg-red-600' : 'text-gray-500'}`}>Plantillas</button>
              <button onClick={() => setUseTemplate(false)} className={`flex-1 py-3 rounded-lg font-bold text-sm uppercase ${!useTemplate ? 'bg-red-600' : 'text-gray-500'}`}>Mi .AWC / Resident</button>
            </div>

            {!useTemplate && (
              <div className="mb-6 p-4 bg-red-500/5 border border-red-500/20 rounded-xl">
                <p className="text-xs text-gray-400 mb-2">Para archivos grandes, pon el nombre del sonido (ej: PTL_PISTOL_SHOT.R):</p>
                <input type="text" placeholder="Ej: PTL_PISTOL_SHOT.R" value={surgicalName} onChange={(e) => setSurgicalName(e.target.value)} className="w-full bg-black border border-white/10 rounded-lg px-4 py-2 text-sm uppercase font-mono" />
              </div>
            )}

            {useTemplate ? (
              <div className="grid grid-cols-2 gap-4">
                {weapons.map(w => (
                  <button key={w.id} onClick={() => setWeaponType(w.id)} className={`p-4 rounded-xl border text-sm uppercase ${weaponType === w.id ? 'border-red-500 bg-red-500/10' : 'border-white/5'}`}>{w.name}</button>
                ))}
              </div>
            ) : (
              <input type="file" accept=".awc" onChange={(e) => setAwcFile(e.target.files[0])} className="w-full bg-white/5 p-4 rounded-xl border border-white/10" />
            )}
          </GlassCard>

          <GlassCard className="p-8 border-red-500/20">
            <h2 className="text-xl font-bold mb-6 uppercase flex items-center gap-4">
              <span className="w-8 h-8 rounded-full bg-red-500 flex items-center justify-center text-xs">3</span>
              Frecuencia
            </h2>
            <div className="grid grid-cols-4 gap-4">
              {['36000', '32000', '24000', '22050'].map(rate => (
                <button key={rate} onClick={() => setSampleRate(rate)} className={`py-2 rounded-lg border font-mono ${sampleRate === rate ? 'bg-red-500' : 'border-white/5'}`}>{rate}</button>
              ))}
            </div>
          </GlassCard>

          <button onClick={handleInyectar} disabled={isLoading} className="w-full py-5 rounded-2xl bg-red-600 font-bold uppercase tracking-widest text-xl">
            {isLoading ? 'Procesando...' : 'Inyectar Sonido'}
          </button>

          {error && <p className="p-4 bg-red-500/10 text-red-500 rounded-xl text-xs font-mono">{error}</p>}
          {success && <p className="p-4 bg-green-500/10 text-green-500 rounded-xl font-bold uppercase">{success}</p>}
        </div>
      </main>
    </div>
  );
}
