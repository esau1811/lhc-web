'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession, signIn } from 'next-auth/react';
import { motion } from 'framer-motion';
import { Crown, Menu, X } from 'lucide-react';
import { useState } from 'react';
import { useLang } from '@/components/LangProvider';

export default function Header() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { lang, changeLang, t } = useLang();

  // Fix: Disable body scroll when menu is open
  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => { document.body.style.overflow = 'unset'; };
  }, [isMobileMenuOpen]);

  const navLinks = [
    { name: t('nav_inicio'), path: '/' },
    { name: t('nav_herramientas'), path: '/#tools' },
    { name: t('nav_comunidad'), path: 'https://discord.gg/lhcds' },
    { name: t('nav_premium'), path: '/premium' },
    { name: t('nav_soporte'), path: 'https://discord.gg/lhcds' },
  ];

  const languages = [
    { id: 'en', flag: '/flags/en.png' },
    { id: 'es', flag: '/flags/es.png' },
    { id: 'it', flag: '/flags/it.png' },
    { id: 'pt', flag: '/flags/pt.png' },
  ];

  return (
    <>
      <nav className="fixed top-0 left-0 right-0 z-50 px-6 py-6 bg-transparent">
        <div className="max-w-[1400px] mx-auto flex items-center justify-between">
          
          <div className="flex items-center gap-8">
            <Link href="/" className="flex items-center gap-2">
              <img src="/logo.png" alt="LHC" className="h-10 md:h-12 w-auto" />
            </Link>

            {/* Language Selector Desktop */}
            <div className="hidden md:flex items-center gap-1 bg-black/20 p-1 rounded-full border border-white/5 backdrop-blur-md">
              {languages.map((l) => (
                <button
                  key={l.id}
                  onClick={() => changeLang(l.id)}
                  className={`w-7 h-7 rounded-full flex items-center justify-center transition-all overflow-hidden relative group ${
                    lang === l.id 
                    ? 'ring-2 ring-red-500 scale-110 z-10' 
                    : 'grayscale opacity-50 hover:grayscale-0 hover:opacity-100 hover:scale-105'
                  }`}
                >
                  <img src={l.flag} alt={l.id} className="w-full h-full object-cover" />
                  {lang === l.id && (
                    <div className="absolute inset-0 bg-red-500/10 shadow-[inset_0_0_8px_rgba(234,179,8,0.5)]"></div>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Desktop Nav */}
          <div className="hidden lg:flex items-center gap-10">
            {navLinks.map(link => (
              <Link 
                key={link.name} 
                href={link.path}
                className={`text-[13px] font-bold tracking-tight transition-colors ${
                  pathname === link.path ? 'text-red-500' : 'text-zinc-500 hover:text-white'
                }`}
              >
                {link.name}
              </Link>
            ))}
          </div>

          <div className="flex items-center gap-4">
            <Link href="/premium?tab=WEB" className="hidden md:flex items-center gap-2 bg-red-500/5 border border-red-500/20 px-4 py-2 rounded-lg text-[11px] font-black text-red-500 hover:bg-red-500/10 transition-all">
              <Crown size={14} /> {t('hazte_premium')}
            </Link>
            
            {session ? (
              <div className="hidden md:flex items-center gap-3 bg-white/5 p-1.5 pr-4 rounded-full border border-white/5">
                <img src={session.user.image} className="w-8 h-8 rounded-full" />
                <div className="flex flex-col">
                  <span className="text-[11px] font-black text-white leading-tight uppercase">{session.user.name.split(' ')[0]}</span>
                  <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-tighter">{t('conectado')}</span>
                </div>
              </div>
            ) : (
              <button 
                onClick={() => signIn('discord')}
                className="hidden md:block bg-indigo-600 hover:bg-indigo-500 px-6 py-2 rounded-lg text-[11px] font-black transition-all text-white"
              >
                {t('login_btn')}
              </button>
            )}

            {/* Mobile Toggle */}
            <button 
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="lg:hidden p-2 text-white bg-white/5 rounded-lg border border-white/10"
            >
              {isMobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="fixed inset-0 z-[40] bg-black/98 backdrop-blur-2xl lg:hidden flex flex-col p-6 pt-24 gap-4 overflow-y-auto"
        >
          {navLinks.map(link => (
            <Link 
              key={link.name} 
              href={link.path}
              onClick={() => setIsMobileMenuOpen(false)}
              className={`text-xl font-black uppercase tracking-tighter py-1 ${
                pathname === link.path ? 'text-red-500' : 'text-zinc-500'
              }`}
            >
              {link.name}
            </Link>
          ))}
          <div className="h-[1px] bg-white/5 my-2"></div>
          
          <div className="flex flex-col gap-3">
            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-600">Idioma / Language</span>
            <div className="flex items-center gap-3">
              {languages.map((l) => (
                <button
                  key={l.id}
                  onClick={() => {
                    changeLang(l.id);
                    setIsMobileMenuOpen(false);
                  }}
                  className={`w-10 h-10 rounded-full flex items-center justify-center transition-all overflow-hidden border-2 ${
                    lang === l.id 
                    ? 'border-red-500 scale-105' 
                    : 'border-white/5 grayscale opacity-40'
                  }`}
                >
                  <img src={l.flag} alt={l.id} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          </div>

          <div className="h-[1px] bg-white/5 my-2"></div>
          
          <div className="flex flex-col gap-3 mt-auto pb-10">
            <Link 
              href="/premium?tab=WEB" 
              onClick={() => setIsMobileMenuOpen(false)}
              className="flex items-center justify-between bg-red-600/10 border border-red-600/30 text-red-500 p-4 rounded-xl font-black uppercase text-xs"
            >
              {t('hazte_premium')} <Crown size={16} />
            </Link>
            <button 
              onClick={() => {
                signIn('discord');
                setIsMobileMenuOpen(false);
              }}
              className="bg-[#5865F2] text-white p-4 rounded-xl font-black uppercase text-xs shadow-lg shadow-indigo-500/20"
            >
              {t('login_btn') || 'Iniciar sesión'}
            </button>
          </div>
        </motion.div>
      )}
    </>
  );
}
