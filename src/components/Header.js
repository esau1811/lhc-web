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

  const navLinks = [
    { name: t('nav_inicio'), path: '/' },
    { name: t('nav_herramientas'), path: '/converter' },
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
      <nav className="absolute top-0 left-0 right-0 z-50 px-6 py-6">
        <div className="max-w-[1400px] mx-auto flex items-center justify-between">
          
          <div className="flex items-center gap-8">
            <Link href="/" className="flex items-center gap-2">
              <img src="/logo.png" alt="LHC" className="h-12 w-auto" />
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
                className="hidden md:block bg-indigo-600 hover:bg-indigo-500 px-6 py-2 rounded-lg text-[11px] font-black transition-all"
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
          className="fixed inset-0 z-[40] bg-black/95 backdrop-blur-xl lg:hidden flex flex-col p-8 pt-32 gap-6"
        >
          {navLinks.map(link => (
            <Link 
              key={link.name} 
              href={link.path}
              onClick={() => setIsMobileMenuOpen(false)}
              className={`text-2xl font-black uppercase tracking-tighter ${
                pathname === link.path ? 'text-red-500' : 'text-zinc-500'
              }`}
            >
              {link.name}
            </Link>
          ))}
          <div className="h-[1px] bg-white/10 my-4"></div>
          
          <div className="flex flex-col gap-4">
            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Idioma / Language</span>
            <div className="flex items-center gap-4">
              {languages.map((l) => (
                <button
                  key={l.id}
                  onClick={() => {
                    changeLang(l.id);
                    setIsMobileMenuOpen(false);
                  }}
                  className={`w-12 h-12 rounded-full flex items-center justify-center transition-all overflow-hidden border-2 ${
                    lang === l.id 
                    ? 'border-red-500 scale-110' 
                    : 'border-white/10 grayscale opacity-50'
                  }`}
                >
                  <img src={l.flag} alt={l.id} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          </div>

          <div className="h-[1px] bg-white/10 my-4"></div>
          
          <Link 
            href="/premium?tab=WEB" 
            onClick={() => setIsMobileMenuOpen(false)}
            className="flex items-center justify-between bg-red-500 text-black p-4 rounded-2xl font-black uppercase text-sm"
          >
            {t('hazte_premium')} <Crown size={18} />
          </Link>
          <button 
            onClick={() => {
              signIn('discord');
              setIsMobileMenuOpen(false);
            }}
            className="bg-[#5865F2] text-white p-4 rounded-2xl font-black uppercase text-sm"
          >
            {t('login')}
          </button>
        </motion.div>
      )}
    </>
  );
}
