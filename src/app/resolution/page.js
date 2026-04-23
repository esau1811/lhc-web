'use client';

import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { useLang } from '@/components/LangProvider';
import Link from 'next/link';

export default function ResolutionPage() {
  const { t } = useLang();

  return (
    <>
      <Header showBack title="lhcresolution" highlight="resolution" />
      <main className="page-container maintenance-page">
        <div className="maintenance-card resolution-card premium-locked">
          <span className="maintenance-icon">🖥️</span>
          <h1 className="maintenance-title">lhc<span style={{ color: 'var(--accent-red)' }}>resolution</span></h1>
          
          <div className="maintenance-badge" style={{ 
            background: 'rgba(231, 76, 60, 0.1)', 
            borderColor: 'rgba(231, 76, 60, 0.3)',
            color: 'var(--accent-red)'
          }}>
            <div className="dot" style={{ background: 'var(--accent-red)' }}></div>
            {t('maintenance')}
          </div>
          
          <p className="maintenance-desc">
            {t('resolutionMaintenanceDesc')}
          </p>

          <div className="maintenance-features">
            <div className="maintenance-feature" style={{ opacity: 0.5 }}>
              <span className="maintenance-feature-icon">📺</span>
              {t('resShortcuts')}
            </div>
            <div className="maintenance-feature" style={{ opacity: 0.5 }}>
              <span className="maintenance-feature-icon">📐</span>
              {t('resAnySize')}
            </div>
            <div className="maintenance-feature" style={{ opacity: 0.5 }}>
              <span className="maintenance-feature-icon">⚡</span>
              {t('resOneClick')}
            </div>
            <div className="maintenance-feature" style={{ opacity: 0.5 }}>
              <span className="maintenance-feature-icon">📌</span>
              {t('resStretchable')}
            </div>
          </div>

          <Link 
            href="https://discord.gg/lhcds" 
            className="btn-pill btn-gold px-10 py-4"
          >
            {t('getOnDiscord')}
          </Link>

          <div style={{ marginTop: 'var(--space-md)' }}>
            <Link href="/" className="btn-back">
              ← {t('backToToolsBtn')}
            </Link>
          </div>
        </div>
      </main>
      <Footer highlight="resolution" />
    </>
  );
}
