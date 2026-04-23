'use client';

import Link from 'next/link';
import { useLang } from '@/components/LangProvider';

export default function Footer() {
  const { t } = useLang();
  return (
    <footer className="max-w-[1400px] mx-auto px-6 py-12 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-6">
      <div className="flex items-center gap-2">
        <img src="/logo.png" className="h-8 w-auto opacity-50" />
      </div>
      
      <div className="flex items-center gap-8 text-xs font-bold text-zinc-500 tracking-widest uppercase">
        <a href="https://discord.gg/lhcds" className="hover:text-white transition-colors">{t('nav_comunidad')}</a>
        <Link href="/premium" className="hover:text-white transition-colors">{t('nav_premium')}</Link>
        <Link href="/converter" className="hover:text-white transition-colors">Converter</Link>
        <a href="#" className="hover:text-white transition-colors">Términos</a>
      </div>
    </footer>
  );
}
