'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession, signIn } from 'next-auth/react';
import { motion } from 'framer-motion';
import { Crown, Menu, X } from 'lucide-react';
import { useState } from 'react';

export default function Header() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const navLinks = [
    { name: 'Inicio', path: '/' },
    { name: 'Herramientas', path: '/converter' },
    { name: 'Comunidad', path: 'https://discord.gg/AS46Hlp2vO' },
    { name: 'Premium', path: '/premium' },
    { name: 'Soporte', path: 'https://discord.gg/AS46Hlp2vO' },
  ];

  return (
    <>
      <nav className="absolute top-0 left-0 right-0 z-50 px-6 py-6">
        <div className="max-w-[1400px] mx-auto flex items-center justify-between">
          
          <Link href="/" className="flex items-center gap-2">
            <img src="/logo.png" alt="LHC" className="h-8 w-auto" />
          </Link>

          {/* Desktop Nav */}
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

          <div className="flex items-center gap-4">
            <Link href="/premium" className="hidden md:flex items-center gap-2 bg-yellow-500/5 border border-yellow-500/20 px-4 py-2 rounded-lg text-[11px] font-black text-yellow-500 hover:bg-yellow-500/10 transition-all">
              <Crown size={14} /> Hazte Premium
            </Link>
            
            {session ? (
              <div className="hidden md:flex items-center gap-3 bg-white/5 p-1.5 pr-4 rounded-full border border-white/5">
                <img src={session.user.image} className="w-8 h-8 rounded-full" />
                <div className="flex flex-col">
                  <span className="text-[11px] font-black text-white leading-tight uppercase">{session.user.name.split(' ')[0]}</span>
                  <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-tighter">Conectado</span>
                </div>
              </div>
            ) : (
              <button 
                onClick={() => signIn('discord')}
                className="hidden md:block bg-indigo-600 hover:bg-indigo-500 px-6 py-2 rounded-lg text-[11px] font-black transition-all"
              >
                LOGIN
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
                pathname === link.path ? 'text-yellow-500' : 'text-zinc-500'
              }`}
            >
              {link.name}
            </Link>
          ))}
          <div className="h-[1px] bg-white/10 my-4"></div>
          <Link 
            href="/premium" 
            onClick={() => setIsMobileMenuOpen(false)}
            className="flex items-center justify-between bg-yellow-500 text-black p-4 rounded-2xl font-black uppercase text-sm"
          >
            Hazte Premium <Crown size={18} />
          </Link>
          <button 
            onClick={() => {
              signIn('discord');
              setIsMobileMenuOpen(false);
            }}
            className="bg-[#5865F2] text-white p-4 rounded-2xl font-black uppercase text-sm"
          >
            Login con Discord
          </button>
        </motion.div>
      )}
    </>
  );
}
