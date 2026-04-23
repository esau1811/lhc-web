'use client';

import Header from '@/components/Header';
import Footer from '@/components/Footer';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import GlassCard from '@/components/GlassCard';
import { 
  Check, Rocket, Shield, Zap, ShoppingBag, Crown, 
  LayoutGrid, Settings, User, MessageSquare, ExternalLink,
  Clock, Activity, ChevronRight, Star, Monitor, Target, Music
} from 'lucide-react';

export default function HomePage() {
  const [discordStats, setDiscordStats] = useState({ total: '10K+', online: '31' });

  const categories = [
    { name: 'Todas', icon: LayoutGrid, active: true },
    { name: 'Optimización', icon: Zap },
    { name: 'Personalización', icon: Settings },
    { name: 'Utilidades', icon: Shield },
    { name: 'Comunidad', icon: User },
  ];

  const featuredTools = [
    { 
      id: 'conv',
      name: 'LHCConverter', 
      desc: 'Convierte y optimiza tus armas. Compatible con +50 juegos.', 
      icon: '/icon_conv.png', 
      badge: 'GRATIS', 
      badgeColor: 'bg-green-500',
      glowClass: 'green-glow',
      users: '5.2K',
      rating: '4.8'
    },
    { 
      id: 'sound',
      name: 'LHCSound', 
      desc: 'Personaliza sonidos y efectos. Biblioteca de +1000 sonidos.', 
      icon: '/icon_sound.png', 
      badge: 'PRONTO', 
      badgeColor: 'bg-purple-500',
      glowClass: 'nitro-glow',
      users: '3.1K',
      rating: '4.6'
    },
    { 
      id: 'res',
      name: 'LHCResolution', 
      desc: 'Optimiza tu experiencia visual. Perfiles para cada sistema.', 
      icon: '/icon_res.png', 
      badge: 'PREMIUM', 
      badgeColor: 'bg-blue-500',
      glowClass: 'blue-glow',
      users: '2.8K',
      rating: '4.9'
    },
    { 
      id: 'train',
      name: 'LHCTrainer', 
      desc: 'Herramientas de entrenamiento. Mejora tus habilidades.', 
      icon: '/icon_train.png', 
      badge: 'PREMIUM', 
      badgeColor: 'bg-yellow-500',
      glowClass: 'opti-glow',
      users: '1.5K',
      rating: '4.7'
    },
  ];

  const recentActivity = [
    { name: 'LHCConverter', action: 'Actualizado v2.1.4', time: 'Hace 2h', icon: '/icon_conv.png' },
    { name: 'LHCSound', action: 'Nueva biblioteca', time: 'Hace 4h', icon: '/icon_sound.png' },
    { name: 'LHCResolution', action: 'Perfil agregado', time: 'Hace 6h', icon: '/icon_res.png' },
    { name: 'Nuevo usuario', action: 'Se unió a la comunidad', time: 'Hace 8h', isUser: true },
  ];

  return (
    <div className="min-h-screen bg-[#050505] text-white selection:bg-yellow-500/30">
      <Header />
      
      <main className="max-w-[1400px] mx-auto px-6 pt-24 pb-20">
        
        {/* HERO SECTION DASHBOARD STYLE */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-10">
          
          {/* MAIN HERO CARD */}
          <div className="lg:col-span-9 relative overflow-hidden rounded-3xl bg-gradient-to-br from-zinc-900 to-black border border-white/5 p-12 min-h-[500px] flex items-center">
            {/* Background Glow */}
            <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-yellow-500/10 blur-[120px] rounded-full -mr-40 -mt-40"></div>
            
            <div className="relative z-10 max-w-xl">
              <motion.h1 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-7xl font-black mb-6 leading-[0.9] tracking-tighter"
              >
                ELEVA TU <br />
                <span className="text-yellow-500">EXPERIENCIA</span>
              </motion.h1>
              <p className="text-zinc-400 text-lg mb-10 max-w-md font-medium leading-relaxed">
                Herramientas premium para jugadores que buscan más. Optimiza, personaliza y domina tu entorno de juego.
              </p>
              <div className="flex flex-wrap gap-4">
                <Link href="/converter" className="btn-pill btn-gold px-8 py-4 text-sm font-black flex items-center gap-2">
                  <Rocket size={18} /> Explorar Herramientas
                </Link>
                <Link href="/premium" className="btn-pill bg-white/5 border border-white/10 hover:bg-white/10 px-8 py-4 text-sm font-black flex items-center gap-2">
                  <Crown size={18} /> Ver Beneficios Premium
                </Link>
              </div>
            </div>

            {/* Hero Character Image */}
            <div className="absolute right-0 bottom-0 w-[650px] pointer-events-none hidden lg:block">
              <img src="/hero_char.png" alt="Character" className="w-full h-auto object-contain drop-shadow-[0_0_50px_rgba(255,191,0,0.2)]" />
            </div>

            {/* Stats Bar Integrated in Hero */}
            <div className="absolute bottom-10 left-12 flex gap-8 items-center">
              <div className="flex flex-col">
                <span className="text-xl font-black text-white">10K+</span>
                <span className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold">Usuarios Activos</span>
              </div>
              <div className="w-[1px] h-8 bg-white/10"></div>
              <div className="flex flex-col">
                <span className="text-xl font-black text-white">25+</span>
                <span className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold">Herramientas</span>
              </div>
              <div className="w-[1px] h-8 bg-white/10"></div>
              <div className="flex flex-col">
                <span className="text-xl font-black text-white">99.9%</span>
                <span className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold">Tiempo Activo</span>
              </div>
              <div className="w-[1px] h-8 bg-white/10"></div>
              <div className="flex flex-col">
                <span className="text-xl font-black text-white">24/7</span>
                <span className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold">Soporte</span>
              </div>
            </div>
          </div>

          {/* SIDE PREMIUM CARD */}
          <div className="lg:col-span-3 flex flex-col gap-6">
            <GlassCard className="p-8 border-yellow-500/20 bg-yellow-500/5 flex-1 relative overflow-hidden flex flex-col justify-between">
              <div className="absolute top-0 right-0 p-4 opacity-10">
                <Crown size={80} />
              </div>
              
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Crown size={16} className="text-yellow-500" />
                  <span className="text-[11px] font-black uppercase tracking-widest text-yellow-500">Premium</span>
                </div>
                <h3 className="text-2xl font-black mb-6">Desbloquea todo el potencial</h3>
                <ul className="space-y-4 mb-8">
                  {[
                    'Acceso a herramientas exclusivas',
                    'Actualizaciones prioritarias',
                    'Soporte VIP 24/7',
                    'Sin anuncios'
                  ].map((item, i) => (
                    <li key={i} className="flex items-center gap-3 text-xs font-bold text-zinc-300">
                      <Check size={14} className="text-yellow-500" /> {item}
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <Link href="/premium" className="w-full py-4 bg-yellow-500 text-black rounded-xl text-xs font-black flex items-center justify-center gap-2 hover:bg-yellow-400 transition-all shadow-[0_0_20px_rgba(234,179,8,0.3)]">
                  <Crown size={14} /> Mejorar a Premium
                </Link>
                <p className="text-center text-[10px] text-zinc-500 mt-4 font-bold uppercase tracking-tight">Desde $4.99/mes</p>
              </div>
            </GlassCard>
          </div>
        </section>

        {/* MAIN DASHBOARD CONTENT */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* LEFT SIDEBAR: CATEGORIES */}
          <div className="lg:col-span-2 space-y-8">
            <div>
              <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 mb-6 px-2">Categorías</h4>
              <nav className="space-y-1">
                {categories.map(cat => (
                  <button 
                    key={cat.name}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-[13px] font-bold transition-all ${
                      cat.active ? 'bg-white/10 text-white' : 'text-zinc-500 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <cat.icon size={18} className={cat.active ? 'text-yellow-500' : ''} />
                    {cat.name}
                  </button>
                ))}
              </nav>
            </div>

            <Link href="https://discord.gg/AS46Hlp2vO" className="flex items-center justify-between bg-[#5865F2] hover:bg-[#4752c4] p-4 rounded-2xl transition-all group">
              <div className="flex items-center gap-3">
                <div className="bg-white/20 p-2 rounded-lg">
                  <MessageSquare size={18} />
                </div>
                <div>
                  <p className="text-[11px] font-black uppercase leading-none">Únete a Discord</p>
                  <p className="text-[9px] font-bold opacity-70">Comunidad activa</p>
                </div>
              </div>
              <ChevronRight size={16} className="group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>

          {/* CENTER: FEATURED TOOLS GRID */}
          <div className="lg:col-span-7">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <Zap size={20} className="text-yellow-500" />
                <h3 className="text-xl font-black uppercase tracking-tight">Herramientas Destacadas</h3>
              </div>
              <Link href="/converter" className="text-xs font-bold text-zinc-500 hover:text-white flex items-center gap-1 transition-colors">
                Ver todas <ChevronRight size={14} />
              </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {featuredTools.map((tool, idx) => (
                <GlassCard key={idx} className="p-6 group cursor-pointer hover:border-white/10 transition-all">
                  <div className="flex justify-between items-start mb-6">
                    <div className="p-3 bg-white/5 rounded-2xl group-hover:scale-110 transition-transform">
                      <img src={tool.icon} alt={tool.name} className={`w-12 h-12 object-contain ai-icon-blend opacity-20 group-hover:opacity-100 transition-all duration-500 ${tool.glowClass}`} />
                    </div>
                    <span className={`${tool.badgeColor} text-[9px] font-black px-2 py-1 rounded-md`}>
                      {tool.badge}
                    </span>
                  </div>
                  <h4 className="text-lg font-black mb-2 group-hover:text-yellow-500 transition-colors">{tool.name}</h4>
                  <p className="text-zinc-500 text-xs font-medium leading-relaxed mb-6">
                    {tool.desc}
                  </p>
                  <div className="flex items-center justify-between pt-4 border-t border-white/5">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-1">
                        <User size={12} className="text-zinc-500" />
                        <span className="text-[10px] font-bold text-zinc-400">{tool.users}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Star size={12} className="text-yellow-500" />
                        <span className="text-[10px] font-bold text-zinc-400">{tool.rating}</span>
                      </div>
                    </div>
                    <ChevronRight size={14} className="text-zinc-700 group-hover:text-white group-hover:translate-x-1 transition-all" />
                  </div>
                </GlassCard>
              ))}
            </div>

            {/* BOTTOM BANNER */}
            <div className="mt-8 relative overflow-hidden rounded-3xl bg-gradient-to-r from-yellow-500/20 to-transparent border border-yellow-500/10 p-8 flex items-center justify-between">
              <div className="flex items-center gap-6">
                <div className="bg-yellow-500 p-4 rounded-2xl text-black">
                  <User size={24} />
                </div>
                <div>
                  <h4 className="text-lg font-black uppercase tracking-tight leading-none mb-1">Únete a miles de jugadores</h4>
                  <p className="text-xs text-zinc-500 font-bold">Forma parte de la comunidad #1 en herramientas para gamers</p>
                </div>
              </div>
              <div className="flex items-center gap-6">
                <div className="flex flex-col items-end">
                  <span className="text-xl font-black">10K+</span>
                  <span className="text-[10px] text-zinc-500 font-bold uppercase">Miembros</span>
                </div>
                <Link href="https://discord.gg/AS46Hlp2vO" className="bg-yellow-500 text-black px-6 py-3 rounded-xl text-xs font-black flex items-center gap-2 hover:bg-yellow-400 transition-all">
                  Únete ahora <ArrowRight size={14} />
                </Link>
              </div>
            </div>
          </div>

          {/* RIGHT SIDEBAR: ACTIVITY & STATUS */}
          <div className="lg:col-span-3 space-y-6">
            <GlassCard className="p-6" hideBorder>
              <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 mb-6">Actividad Reciente</h4>
              <div className="space-y-6">
                {recentActivity.map((act, i) => (
                  <div key={i} className="flex items-center gap-4">
                    {act.isUser ? (
                      <div className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center">
                        <User size={18} className="text-zinc-400" />
                      </div>
                    ) : (
                      <div className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center p-2">
                        <img src={act.icon} className="w-full h-full object-contain ai-icon-blend" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-black truncate">{act.name}</p>
                      <p className="text-[10px] text-zinc-500 font-bold truncate">{act.action}</p>
                    </div>
                    <span className="text-[9px] text-zinc-600 font-bold whitespace-nowrap">{act.time}</span>
                  </div>
                ))}
              </div>
            </GlassCard>

            <GlassCard className="p-6 bg-green-500/5 border-green-500/20" hideBorder>
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-green-500/20 rounded-full flex items-center justify-center relative">
                  <Activity size={20} className="text-green-500" />
                  <span className="absolute top-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-black animate-pulse"></span>
                </div>
                <div>
                  <p className="text-[11px] font-black uppercase tracking-tight">Todos los sistemas</p>
                  <p className="text-[10px] text-green-500 font-black uppercase tracking-tighter">Operativo</p>
                </div>
              </div>
            </GlassCard>
          </div>

        </div>

      </main>

      <Footer />
    </div>
  );
}

const ArrowRight = ({ size, className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M5 12h14M12 5l7 7-7 7" />
  </svg>
);
