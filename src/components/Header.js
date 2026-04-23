'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession, signIn, signOut } from 'next-auth/react';
import { motion } from 'framer-motion';

export default function Header() {
  const pathname = usePathname();
  const { data: session } = useSession();

  const navLinks = [
    { name: 'Inicio', path: '/' },
    { name: 'Servicios', path: '/premium' },
    { name: 'Converter', path: '/converter' },
    { name: 'Comunidad', path: 'https://discord.gg/AS46Hlp2vO' },
  ];

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 px-6 py-4">
      <div className="max-w-7xl mx-auto flex items-center justify-between bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl px-6 py-3">
        
        <Link href="/" className="flex items-center gap-2">
          <img src="/logo.png" alt="LHC" className="h-8 w-auto" />
          <span className="font-black text-xl tracking-tighter">LHC</span>
        </Link>

        <div className="hidden md:flex items-center gap-8">
          {navLinks.map(link => (
            <Link 
              key={link.name} 
              href={link.path}
              className={`text-sm font-bold tracking-wide uppercase transition-colors ${
                pathname === link.path ? 'text-yellow-500' : 'text-zinc-400 hover:text-white'
              }`}
            >
              {link.name}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-4">
          {session ? (
            <div className="flex items-center gap-3">
              <img src={session.user.image} className="w-8 h-8 rounded-full border border-yellow-500" />
              <button onClick={() => signOut()} className="text-xs font-bold text-zinc-500 hover:text-white">SALIR</button>
            </div>
          ) : (
            <button 
              onClick={() => signIn('discord')}
              className="bg-indigo-600 hover:bg-indigo-500 px-5 py-2 rounded-full text-xs font-black transition-all"
            >
              LOGIN
            </button>
          )}
          <Link href="/premium" className="bg-gradient-to-r from-yellow-400 to-orange-500 text-black px-5 py-2 rounded-full text-xs font-black hover:scale-105 transition-all">
            PREMIUM
          </Link>
        </div>

      </div>
    </nav>
  );
}
