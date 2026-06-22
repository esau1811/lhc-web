'use client';

import { useSession, signIn } from 'next-auth/react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import Header from '@/components/Header';
import { useLang } from '@/components/LangProvider';
import { motion } from 'framer-motion';
import { Trophy, Users, User, Clock, Ticket, ShieldCheck } from 'lucide-react';

const DiscordIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057c.003.022.015.043.032.056a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/>
  </svg>
);

export default function ComunidadLayout({ children }) {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const { t } = useLang();

  const navLinks = [
    { key: 'c_nav_home',        href: '/comunidad',            icon: <Trophy size={13} /> },
    { key: 'c_nav_leaderboard', href: '/comunidad/leaderboard', icon: <Trophy size={13} /> },
    { key: 'c_nav_teams',       href: '/comunidad/teams',       icon: <Users size={13} /> },
    { key: 'c_nav_players',     href: '/comunidad/players',     icon: <User size={13} /> },
    { key: 'c_nav_matches',     href: '/comunidad/partidas',    icon: <Clock size={13} /> },
    { key: 'c_nav_ticket',      href: '/comunidad/tickets',     icon: <Ticket size={13} /> },
  ];

  if (status === 'loading') {
    return (
      <div className="min-h-screen text-white flex items-center justify-center" style={{ background: '#050505' }}>
        <div className="w-8 h-8 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen text-white" style={{ background: '#050505' }}>
        <Header />
        <main className="max-w-xl mx-auto px-6 pt-36 pb-20 flex flex-col items-center text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="w-full">
            <div className="relative mx-auto w-24 h-24 mb-8">
              <div className="absolute inset-0 bg-cyan-500/10 rounded-full blur-xl animate-pulse" />
              <div className="relative w-24 h-24 rounded-full border border-white/10 flex items-center justify-center" style={{ background: '#111' }}>
                <img src="/logo.png" alt="LHC" className="w-14 h-14 object-contain opacity-80" />
              </div>
            </div>
            <div className="text-xs font-black uppercase tracking-widest text-cyan-500 mb-3">LHC Comunidad</div>
            <h1 className="text-3xl font-black uppercase tracking-tight mb-3">{t('c_restricted_title')}</h1>
            <p className="text-zinc-500 mb-8 font-medium">{t('c_restricted_desc')}</p>
            <button onClick={() => signIn('discord')}
              className="flex items-center justify-center gap-3 w-full text-white font-black py-4 px-8 rounded-xl transition-all text-sm"
              style={{ background: '#5865F2' }}
              onMouseEnter={e => e.currentTarget.style.background = '#4752c4'}
              onMouseLeave={e => e.currentTarget.style.background = '#5865F2'}>
              <DiscordIcon /> {t('c_login_with_discord')}
            </button>
          </motion.div>
        </main>
      </div>
    );
  }

  const isAdmin = session.user?.isAdmin;

  return (
    <div className="min-h-screen text-white" style={{ background: '#050505' }}>
      <Header />

      {/* Sub-nav — fully opaque */}
      <div className="fixed top-[72px] left-0 right-0 z-40 border-b border-white/5" style={{ background: '#09090b' }}>
        <div className="max-w-[1400px] mx-auto px-6">
          <div className="flex items-center gap-1 overflow-x-auto py-2" style={{ scrollbarWidth: 'none' }}>
            {navLinks.map(link => (
              <Link key={link.href} href={link.href}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-[11px] font-black uppercase tracking-wider whitespace-nowrap transition-all border"
                style={pathname === link.href
                  ? { background: 'rgba(6,182,212,0.1)', color: '#22d3ee', borderColor: 'rgba(6,182,212,0.3)' }
                  : { color: '#71717a', borderColor: 'transparent' }}
                onMouseEnter={e => { if (pathname !== link.href) { e.currentTarget.style.color = '#fff'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; }}}
                onMouseLeave={e => { if (pathname !== link.href) { e.currentTarget.style.color = '#71717a'; e.currentTarget.style.borderColor = 'transparent'; }}}>
                {link.icon}{t(link.key)}
              </Link>
            ))}
            {isAdmin && (
              <Link href="/comunidad/admin"
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-[11px] font-black uppercase tracking-wider whitespace-nowrap transition-all ml-auto border"
                style={pathname === '/comunidad/admin'
                  ? { background: 'rgba(239,68,68,0.1)', color: '#f87171', borderColor: 'rgba(239,68,68,0.3)' }
                  : { color: 'rgba(239,68,68,0.6)', borderColor: 'transparent' }}>
                <ShieldCheck size={13} /> {t('c_nav_admin')}
              </Link>
            )}
          </div>
        </div>
      </div>

      <main className="max-w-[1400px] mx-auto px-6 pt-36 pb-20">
        {children}
      </main>
    </div>
  );
}
