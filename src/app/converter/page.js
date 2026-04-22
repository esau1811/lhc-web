'use client';

import { useState, useRef, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { useLang } from '@/components/LangProvider';
import { WEAPON_CATEGORIES } from '@/lib/weapons';

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
      setError(t('invalidFile'));
      return;
    }

    setFile(selectedFile);
    setFileInfo({
      name: selectedFile.name,
      size: formatFileSize(selectedFile.size),
    });

    // Upload for analysis
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Upload failed');
        setFile(null);
        setFileInfo(null);
      } else if (data.detectedWeapon) {
        setDetectedWeapon(data.detectedWeapon);
        setSourceWeapon(data.detectedWeapon.id);
      }
    } catch (err) {
      setError('Network error, please try again');
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
      const formData = new FormData();
      formData.append('file', file);
      formData.append('sourceWeapon', sourceWeapon);
      formData.append('targetWeapon', targetWeapon);

      const res = await fetch('/api/convert', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        setError(errData.error || 'Conversion failed');
        return;
      }

      // Download the converted file
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${targetWeapon}.rpf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError('Network error during conversion');
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
