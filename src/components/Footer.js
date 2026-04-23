'use client';

import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="max-w-7xl mx-auto px-6 py-12 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-6">
      <div className="flex items-center gap-2">
        <img src="/logo.png" className="h-8 w-auto opacity-50" />
      </div>
      
      <div className="flex items-center gap-8 text-xs font-bold text-zinc-500 tracking-widest uppercase">
        <a href="https://discord.gg/AS46Hlp2vO" className="hover:text-white transition-colors">Discord</a>
        <Link href="/premium" className="hover:text-white transition-colors">Servicios</Link>
        <Link href="/converter" className="hover:text-white transition-colors">Converter</Link>
        <a href="#" className="hover:text-white transition-colors">Términos</a>
      </div>
    </footer>
  );
}
