'use client';

import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { useLang } from '@/components/LangProvider';
import Link from 'next/link';

export default function SoundPage() {
  const { t } = useLang();

  return (
    <>
      <Header showBack title="lhcsound" highlight="sound" />
      <main className="page-container maintenance-page">
        <div className="maintenance-card">
          <span className="maintenance-icon">🎵</span>
          <h1 className="maintenance-title">lhc<span>sound</span></h1>
          
          <div className="maintenance-badge">
            <div className="dot"></div>
            {t('maintenance')}
          </div>
          
          <p className="maintenance-desc">
            {t('maintenanceDesc')}
          </p>

          <div className="maintenance-features">
            <div className="maintenance-feature" style={{ opacity: 0.5 }}>
              <span className="maintenance-feature-icon">🔫</span>
              {t('soundPistol')}
            </div>
            <div className="maintenance-feature" style={{ opacity: 0.5 }}>
              <span className="maintenance-feature-icon">💥</span>
              {t('soundCombat')}
            </div>
            <div className="maintenance-feature" style={{ opacity: 0.5 }}>
              <span className="maintenance-feature-icon">💀</span>
              {t('killSound')}
            </div>
            <div className="maintenance-feature" style={{ opacity: 0.5 }}>
              <span className="maintenance-feature-icon">👣</span>
              {t('footsteps')}
            </div>
          </div>

          <hr className="maintenance-divider" />

          <Link href="/" className="btn-back">
            ← {t('backToToolsBtn')}
          </Link>
        </div>
      </main>
      <Footer highlight="sound" />
    </>
  );
}
