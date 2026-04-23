'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession, signIn, signOut } from 'next-auth/react';
import { motion } from 'framer-motion';
import { Crown } from 'lucide-react';

export default function Header() {
  const pathname = usePathname();
  const { data: session } = useSession();

  const navLinks = [
    { name: 'Inicio', path: '/' },
    { name: 'Herramientas', path: '/converter' },
    { name: 'Comunidad', path: 'https://discord.gg/AS46Hlp2vO' },
    { name: 'Premium', path: '/premium' },
    { name: 'Soporte', path: 'https://discord.gg/AS46Hlp2vO' },
  ];

  return (
    <nav className="absolute top-0 left-0 right-0 z-50 px-6 py-6">
      <div className="max-w-[1400px] mx-auto flex items-center justify-between">
        
        <Link href="/" className="flex items-center gap-2">
          <img src="/logo.png" alt="LHC" className="h-8 w-auto" />
        </Link>

        <div className="hidden lg:flex items-center gap-10">
          {navLinks.map(link => (
            <Link 
              key={link.name} 
              href={link.path}
              className={`text-[13px] font-bold tracking-tight transition-colors ${
                pathname === link.path ? 'text-yellow-500' : 'text-zinc-500 hover:text-white'
              }`}
            >
              {link.name}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-6">
          <Link href="/premium" className="hidden md:flex items-center gap-2 bg-yellow-500/5 border border-yellow-500/20 px-4 py-2 rounded-lg text-[11px] font-black text-yellow-500 hover:bg-yellow-500/10 transition-all">
            <Crown size={14} /> Hazte Premium
          </Link>
          
          {session ? (
            <div className="flex items-center gap-3 bg-white/5 p-1.5 pr-4 rounded-full border border-white/5">
              <img src={session.user.image} className="w-8 h-8 rounded-full" />
              <div className="flex flex-col">
                <span className="text-[11px] font-black text-white leading-tight uppercase">{session.user.name.split(' ')[0]}</span>
                <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-tighter">Conectado</span>
              </div>
            </div>
          ) : (
            <button 
              onClick={() => signIn('discord')}
              className="bg-indigo-600 hover:bg-indigo-500 px-6 py-2 rounded-lg text-[11px] font-black transition-all"
            >
              LOGIN
            </button>
          )}
        </div>

      </div>
    </nav>
  );
}
