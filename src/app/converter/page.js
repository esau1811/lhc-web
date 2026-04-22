'use client';

import { useState, useRef, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { useLang } from '@/components/LangProvider';
import { WEAPON_CATEGORIES, detectWeaponFromFilenames } from '@/lib/weapons';
import { extractFilenames, extractFromFilename } from '@/lib/rpfParser';

export default function ConverterPage() {
  const { data: session, status } = useSession();
  const { t } = useLang();
  const fileInputRef = useRef(null);

  const [file, setFile] = useState(null);
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

  const handleFile = useCallback(async (selectedFile) => {
    setError('');
    setDetectedWeapon(null);
    setSourceWeapon('');
    setTargetWeapon('');

    if (!selectedFile) return;

    if (!selectedFile.name.toLowerCase().endsWith('.rpf')) {
      setError(t('invalidFile') || 'Solo archivos .rpf permitidos');
      return;
    }

    setFile(selectedFile);
    setFileInfo({
      name: selectedFile.name,
      size: formatFileSize(selectedFile.size),
    });

    // Analyze locally in-memory without uploading
    setIsUploading(true);
    try {
      const arrayBuffer = await selectedFile.arrayBuffer();
      // Only extract names; validation logic from rpfParser runs instantly locally
      const internalFiles = extractFilenames(new Uint8Array(arrayBuffer));
      const filenameHints = extractFromFilename(selectedFile.name);
      
      const allFiles = [...internalFiles, ...filenameHints];
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
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) handleFile(droppedFile);
  }, [handleFile]);

  const handleConvert = async () => {
    if (!file || !sourceWeapon || !targetWeapon || isConverting) return;

    setIsConverting(true);
    setError('');

    try {
      const arrayBuffer = await file.arrayBuffer();
      const u8 = new Uint8Array(arrayBuffer);
      const encoder = new TextEncoder();
      
      // Calculate JOAAT (Jenkins One At A Time) Hash exact as GTA V Engine
      const joaat = (key) => {
          let hash = 0;
          const k = key.toLowerCase();
          for (let i = 0; i < k.length; i++) {
              hash = (hash + k.charCodeAt(i)) | 0;
              hash = (hash + (hash << 10)) | 0;
              hash = (hash ^ (hash >>> 6)) | 0;
          }
          hash = (hash + (hash << 3)) | 0;
          hash = (hash ^ (hash >>> 11)) | 0;
          hash = (hash + (hash << 15)) | 0;
          return hash >>> 0;
      };

      // 1. Identify all files in the archive that belong to the source weapon
      const internalFiles = extractFilenames(u8);
      const view = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
      
      internalFiles.forEach((fname) => {
        const lowerFName = fname.toLowerCase();
        if (lowerFName.includes(sourceWeapon.toLowerCase())) {
          // Calculate Target filename
          const newFName = lowerFName.replace(sourceWeapon.toLowerCase(), targetWeapon.toLowerCase());
          
          // Calculate Hashes
          const oldHash = joaat(lowerFName);
          const newHash = joaat(newFName);
          
          // Scan TOC limit (usually first 2MB) for the oldHash Little Endian and overwrite it!
          const limit = Math.min(u8.length, 2 * 1024 * 1024) - 4;
          for(let i = 0; i <= limit; i++) {
            if (view.getUint32(i, true) === oldHash) {
              view.setUint32(i, newHash, true);
            }
          }
        }
      });

      // 2. Do the standard string replacement (truncating/padding) so OpenIV reads the corrupted table safely
      const replaceInU8 = (bufferArray, srcStr, tgtStr) => {
        const srcBytes = encoder.encode(srcStr);
        const tgtBytesRaw = encoder.encode(tgtStr);
        const tgtBytes = new Uint8Array(srcBytes.length);
        tgtBytes.set(tgtBytesRaw.slice(0, Math.min(tgtBytesRaw.length, srcBytes.length)));

        const indexOf = (arr, search, start) => {
          for (let i = start; i <= arr.length - search.length; i++) {
            let found = true;
            for (let j = 0; j < search.length; j++) {
              if (arr[i + j] !== search[j]) { found = false; break; }
            }
            if (found) return i;
          }
          return -1;
        };

        let offset = 0;
        while (offset < bufferArray.length - srcBytes.length) {
          const idx = indexOf(bufferArray, srcBytes, offset);
          if (idx === -1) break;
          bufferArray.set(tgtBytes, idx);
          offset = idx + srcBytes.length;
        }
      };

      // Replace standard string
      replaceInU8(u8, sourceWeapon, targetWeapon);
      // Replace lowercased variants
      if (sourceWeapon.toLowerCase() !== sourceWeapon) {
        replaceInU8(u8, sourceWeapon.toLowerCase(), targetWeapon.toLowerCase());
      }

      // Download the converted file directly from RAM
      const blob = new Blob([u8], { type: 'application/octet-stream' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${targetWeapon}.rpf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      setError('Error processing file on browser limit');
    } finally {
      setIsConverting(false);
    }
  };

  const removeFile = () => {
    setFile(null);
    setFileInfo(null);
    setDetectedWeapon(null);
    setSourceWeapon('');
    setTargetWeapon('');
    setError('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const isReady = file && sourceWeapon && targetWeapon && !isConverting;

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
              <div className="upload-text">{t('dragDrop')}</div>
              <div className="upload-subtext">{t('orClick')}</div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".rpf"
                className="upload-input"
                onChange={(e) => handleFile(e.target.files[0])}
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
                  disabled={!file}
                >
                  <option value="">
                    {file ? t('selectSource') : t('uploadFirst')}
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
                disabled={!file}
              >
                <option value="">
                  {file ? t('chooseDest') : t('uploadFirst')}
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
