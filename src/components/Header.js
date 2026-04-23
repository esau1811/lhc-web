'use client';

import { useSession, signIn, signOut } from 'next-auth/react';
import { useLang } from './LangProvider';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function Header() {
  const { data: session } = useSession();
  const { t } = useLang();
  const pathname = usePathname();

  const navLinks = [
    { name: 'Inicio', path: '/' },
    { name: 'Herramientas', path: '#tools' },
    { name: 'Comunidad', path: '#community' },
    { name: 'Premium', path: '/premium' },
    { name: 'Soporte', path: 'https://discord.gg/AS46Hlp2vO' },
  ];

  return (
    <header className="header">
      <div className="header-left">
        <Link href="/" className="header-logo" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <img src="/logo.png" alt="LHC Logo" style={{ height: '36px', width: 'auto' }} />
        </Link>
      </div>

      <nav className="header-nav">
        {navLinks.map(link => (
          link.path.startsWith('http') ? (
            <a key={link.name} href={link.path} target="_blank" rel="noopener noreferrer" className="nav-item">
              {link.name}
            </a>
          ) : (
            <Link key={link.name} href={link.path} className={`nav-item ${pathname === link.path ? 'active' : ''}`}>
              {link.name}
            </Link>
          )
        ))}
      </nav>

      <div className="header-right">
        <Link href="/premium" className="btn-primary" style={{ padding: '8px 16px', fontSize: '13px' }}>
          👑 Hazte Premium
        </Link>

        {session ? (
          <div className="user-widget">
            {session.user?.image ? (
              <img
                src={session.user.image}
                alt="Avatar"
                className="user-avatar"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="user-avatar" style={{
                background: 'var(--accent-gradient)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '14px',
                fontWeight: '700',
                color: 'var(--bg-primary)'
              }}>
                {(session.user?.name || 'U')[0].toUpperCase()}
              </div>
            )}
            <span className="user-name">{session.user?.name || 'User'}</span>
            <button className="btn-logout" onClick={() => signOut()}>
              {t('logout') || 'Salir'}
            </button>
          </div>
        ) : (
          <button className="btn-login" onClick={() => signIn('discord')}>
            <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
              <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z" />
            </svg>
            Login
          </button>
        )}
      </div>
    </header>
  );
}
