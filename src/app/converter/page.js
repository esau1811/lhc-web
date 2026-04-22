'use client';

import { useState, useRef, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { useLang } from '@/components/LangProvider';
import { WEAPON_CATEGORIES, detectWeaponFromFilenames } from '@/lib/weapons';
import JSZip from 'jszip';
import { extractFilenames, extractFromFilename } from '@/lib/rpfParser';

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
  const [dragOver, setDragOver] = useState(false);

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const handleFiles = useCallback(async (selectedFiles) => {
    setError('');
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
      
      // Auto detect target weapon
      const filenameHints = fileArray.flatMap(f => extractFromFilename(f.name));
      const allFiles = [...allNames, ...filenameHints];
      const detected = detectWeaponFromFilenames(allFiles);

      if (detected) {
        setDetectedWeapon(detected);
        setSourceWeapon(detected.id);
      }
    } catch (err) {
      console.error(err);
      setError('Error parsing the internal file');
    } finally {
      setIsUploading(false);
    }
  }, [t]);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length > 0) handleFiles(e.dataTransfer.files);
  }, [handleFiles]);

  const handleConvert = async () => {
    if (files.length === 0 || !sourceWeapon || !targetWeapon || isConverting) return;

    setIsConverting(true);
    setError('');

    const BACKEND_URL = 'https://187.33.157.103.nip.io/api/WeaponConverter/convert';

    try {
      if (files.length === 1 && files[0].name.toLowerCase().endsWith('.rpf')) {
        // ENVIAR AL SERVIDOR VPS (Clouding.io)
        const formData = new FormData();
        formData.append('file', files[0]);
        formData.append('sourceWeapon', sourceWeapon);
        formData.append('targetWeapon', targetWeapon);

        const response = await fetch(BACKEND_URL, {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
            throw new Error(`Error del servidor: ${response.statusText}`);
        }

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${targetWeapon}.rpf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      } else {
        // LOOSE FILES METHOD (ZIP)
        const zip = new JSZip();
        
        for (const f of files) {
          const lowerName = f.name.toLowerCase();
          let parsedName = f.name;
          // Si el nombre del archivo contiene la id del arma orígen, renómbralo
          if (lowerName.includes(sourceWeapon.toLowerCase())) {
            // Buscamos usar case regex para preservar las extensiones
            const regex = new RegExp(sourceWeapon, 'gi');
            parsedName = f.name.replace(regex, targetWeapon);
          }
          // Agregamos el archivo renombrado al Zip
          const arrayBuffer = await f.arrayBuffer();
          zip.file(parsedName, arrayBuffer);
        }

        const zipBlob = await zip.generateAsync({ type: 'blob' });
        const url = window.URL.createObjectURL(zipBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${targetWeapon}_lhc.zip`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      }
    } catch (err) {
      console.error(err);
      setError((err.message || 'Error de conexión con el servidor de conversión') + ' [v2.1]');
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
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const isReady = files.length > 0 && sourceWeapon && targetWeapon && !isConverting;

  // Auth gate
  if (status === 'loading') {
    return (
      <>
        <Header showBack title="lhcconverter" highlight="converter" />
        <main className="page-container">
          <div className="auth-gate">
            <div className="spinner" style={{ width: 32, height: 32 }} />
          </div>
        </main>
      </>
    );
  }

  if (!session) {
    return (
      <>
        <Header showBack title="lhcconverter" highlight="converter" />
        <main className="page-container">
          <div className="auth-gate">
            <div style={{ fontSize: 48 }}>🔒</div>
            <h2>{t('login')}</h2>
            <p>You need to log in with Discord to access the weapon converter.</p>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <Header showBack title="lhcconverter" highlight="converter" />
      <main className="page-container">
        {/* Title */}
        <div className="converter-header">
          <h1>{t('weaponConverter')}</h1>
          <p>{t('converterSubtitle')}</p>
        </div>

        {/* Step 1 - Upload */}
        <div className="step-card" id="step-upload">
          <div className="step-label">{t('step1')}</div>

          {!fileInfo ? (
            <div
              className={`upload-zone ${dragOver ? 'drag-over' : ''}`}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
            >
              <div className="upload-icon">📁</div>
              <div className="upload-text">{t('dragDrop')} o Archivos Sueltos</div>
              <div className="upload-subtext">Selecciona tu .RPF o múltiples archivos .ytd/.ydr listos para empaquetarse en ZIP.</div>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".rpf,.ytd,.ydr,.yft,.xml,.meta"
                className="upload-input"
                onChange={(e) => handleFiles(e.target.files)}
              />
            </div>
          ) : (
            <>
              <div className="file-info">
                <div className="file-icon">📄</div>
                <div className="file-details">
                  <div className="file-name">{fileInfo.name}</div>
                  <div className="file-size">{fileInfo.size}</div>
                </div>
                {isUploading ? (
                  <div className="spinner" />
                ) : (
                  <button className="file-remove" onClick={removeFile} aria-label="Remove file">
                    ✕
                  </button>
                )}
              </div>
              {detectedWeapon && (
                <div className="weapon-detected">
                  <span className="weapon-detected-icon">🔍</span>
                  <span className="weapon-detected-label">{t('detectedWeapon')}</span>
                  <span className="weapon-detected-name">{detectedWeapon.name}</span>
                </div>
              )}
            </>
          )}

          {error && (
            <div className="error-msg">
              ⚠️ {error}
            </div>
          )}
        </div>

        {/* Step 2 - From / To */}
        <div className="step-card" id="step-convert-to">
          <div className="step-label">{t('step2')}</div>
          <div className="convert-row">
            <div className="convert-col">
              <label>{t('from')}</label>
              {detectedWeapon ? (
                <div className="source-display auto-detected">
                  <span>{detectedWeapon.name}</span>
                  <span className="auto-badge">{t('auto')}</span>
                </div>
              ) : (
                <select
                  className="weapon-select"
                  value={sourceWeapon}
                  onChange={(e) => setSourceWeapon(e.target.value)}
                  disabled={files.length === 0}
                >
                  <option value="">
                    {files.length > 0 ? t('selectSource') : t('uploadFirst')}
                  </option>
                  {Object.entries(WEAPON_CATEGORIES).map(([catId, cat]) => (
                    <optgroup key={catId} label={cat.label}>
                      {cat.weapons.map((w) => (
                        <option key={w.id} value={w.id}>
                          {w.name}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              )}
            </div>
            <div className="convert-arrow">→</div>
            <div className="convert-col">
              <label>{t('to')}</label>
              <select
                className="weapon-select"
                value={targetWeapon}
                onChange={(e) => setTargetWeapon(e.target.value)}
                disabled={files.length === 0}
              >
                <option value="">
                  {files.length > 0 ? t('chooseDest') : t('uploadFirst')}
                </option>
                {Object.entries(WEAPON_CATEGORIES).map(([catId, cat]) => (
                  <optgroup key={catId} label={cat.label}>
                    {cat.weapons.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Step 3 - Convert */}
        <div className="step-card" id="step-convert">
          <div className="step-label">{t('step3')}</div>
          <button
            className={`btn-convert ${isReady ? 'ready' : ''} ${isConverting ? 'loading' : ''}`}
            onClick={handleConvert}
            disabled={!isReady}
          >
            {isConverting ? (
              <>
                <span className="spinner" />
                {t('converting')}
              </>
            ) : (
              t('convert')
            )}
          </button>
        </div>

        {/* Legal Banner */}
        <div className="legal-banner">
          <span className="legal-banner-icon">⚠️</span>
          <p>{t('legalBanner')}</p>
        </div>
      </main>
      <Footer highlight="converter" />
    </>
  );
}
