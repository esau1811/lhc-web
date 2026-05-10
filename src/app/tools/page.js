'use client';

import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Crown, Rocket, Star, ArrowRight, User, Settings, Activity, Target, Zap, Palette } from 'lucide-react';
import Link from 'next/link';
import GlassCard from '@/components/GlassCard';
import { motion } from 'framer-motion';
import { useLang } from '@/components/LangProvider';

export default function ToolsPage() {
  const { t } = useLang();
  
  const allTools = [
    { 
      id: 'converter',
      category: 'Multimedia',
      name: t('converterTitle'), 
      desc: t('converterDesc'), 
      icon: '/icon_conv.png', 
      badge: t('free'), 
      badgeColor: 'bg-green-500',
      glowClass: 'green-glow',
      users: '5.2K',
      rating: '4.8',
      link: '/converter'
    },
    { 
      id: 'sound',
      category: 'Multimedia',
      name: t('soundTitle'), 
      desc: t('soundDesc'), 
      icon: '/icon_sound.png', 
      badge: t('premium'), 
      badgeColor: 'bg-red-500',
      glowClass: 'nitro-glow',
      users: '3.1K',
      rating: '4.6',
      link: '/sound'
    },
    { 
      id: 'train',
      category: 'Entrenamiento',
      name: 'LHCTrainer', 
      desc: t('trainerDesc'), 
      icon: '/icon_train.png', 
      badge: t('premium'), 
      badgeColor: 'bg-red-500',
      glowClass: 'opti-glow',
      users: '1.5K',
      rating: '4.7',
      link: '/trainer'
    },
    {
      id: 'skinforge',
      category: 'Personalización',
      name: 'LHC SkinForge',
      desc: 'Diseña la skin de tu arma MK2 directamente en el navegador. Pinta, añade stickers y exporta lista para el juego.',
      icon: null,
      badge: 'Mantenimiento',
      badgeColor: 'bg-yellow-500',
      glowClass: 'yellow-glow',
      users: '—',
      rating: '—',
      link: '/tools/weapon-skin',
      iconEl: <Palette size={22} className="text-yellow-400" />
    },
  ];

  return (
    <div className="min-h-screen bg-[#050505] text-white selection:bg-red-500/30">
      <Header />
      
      <main className="max-w-[1400px] mx-auto px-6 pt-32 pb-20">
        {/* Header Section */}
        <div className="text-center mb-20 relative">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-red-500/5 blur-[120px] rounded-full -z-10"></div>
          
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 bg-red-500/10 border border-red-500/20 px-4 py-1.5 rounded-full text-[10px] font-black text-red-500 uppercase tracking-widest mb-6"
          >
            <Settings size={12} className="animate-spin-slow" />
            {t('tools_eco')}
          </motion.div>
          
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-5xl md:text-8xl font-black mb-8 tracking-tighter uppercase leading-[0.9]"
          >
            {t('nav_herramientas')} <br />
            <span className="text-red-500">{t('tools_professional')}</span>
          </motion.h1>
          <p className="text-zinc-400 max-w-2xl mx-auto text-sm md:text-lg font-medium leading-relaxed">
            {t('tools_desc_page')}
          </p>
        </div>

        {/* Stats Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-20">
          {[
            { label: t('nav_herramientas'), val: '03' },
            { label: t('updates'), val: t('weekly') },
            { label: t('uptime'), val: '99.9%' }
          ].map((stat, i) => (
            <GlassCard key={i} className="p-6 text-center border-white/5">
              <div className="text-2xl font-black text-white mb-1">{stat.val}</div>
              <div className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">{stat.label}</div>
            </GlassCard>
          ))}
        </div>

        {/* Tools Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {allTools.map((tool, idx) => (
            <motion.div
              key={tool.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 + (idx * 0.1) }}
            >
              <Link href={tool.link}>
                <GlassCard className="p-6 group cursor-pointer hover:border-white/10 transition-all h-full relative overflow-hidden flex flex-col">
                  {/* Glow Effect on Hover */}
                  <div className={`absolute top-0 right-0 w-32 h-32 blur-[60px] opacity-0 group-hover:opacity-20 transition-opacity rounded-full -mr-16 -mt-16 ${tool.glowClass === 'green-glow' ? 'bg-green-500' : 'bg-red-500'}`}></div>

                  <div className="flex justify-between items-start mb-6">
                    <div className={`w-14 h-14 shrink-0 rounded-2xl bg-white/5 p-3.5 flex items-center justify-center transition-all duration-500 group-hover:scale-110 group-hover:rotate-3 border border-white/5 ${tool.glowClass}`}>
                      {tool.iconEl ? tool.iconEl : <img src={tool.icon} alt={tool.name} className="w-full h-full object-contain ai-icon-blend" />}
                    </div>
                    <div className={`${tool.badgeColor} text-black text-[8px] font-black px-3 py-1.5 rounded-lg uppercase tracking-wider shadow-lg`}>
                      {tool.badge}
                    </div>
                  </div>

                  <div className="flex-1 mb-8">
                    <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest mb-1 block">{tool.category}</span>
                    <h3 className="text-2xl font-black group-hover:text-red-500 transition-colors leading-none mb-3">{tool.name}</h3>
                    <p className="text-zinc-400 text-xs leading-relaxed font-medium line-clamp-2">
                      {tool.desc}
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-5 border-t border-white/5">
                    <div className="flex items-center gap-4">
                      <div className="flex flex-col">
                        <span className="text-xs font-black text-white">{tool.users}</span>
                        <span className="text-[8px] text-zinc-500 font-bold uppercase tracking-tighter">{t('usuarios')}</span>
                      </div>
                      <div className="flex flex-col">
                        <div className="flex items-center gap-1">
                          <span className="text-xs font-black text-white">{tool.rating}</span>
                          <Star size={8} className="fill-red-500 text-red-500" />
                        </div>
                        <span className="text-[8px] text-zinc-500 font-bold uppercase tracking-tighter">Rating</span>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2 text-[10px] font-black text-white uppercase group-hover:text-red-500 transition-colors">
                      {t('open')} <ArrowRight size={12} className="group-hover:translate-x-1 transition-transform" />
                    </div>
                  </div>
                </GlassCard>
              </Link>
            </motion.div>
          ))}
        </div>

        {/* Discord Banner */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.6 }}
          className="mt-20 p-8 md:p-12 rounded-[32px] bg-gradient-to-br from-red-500/10 to-transparent border border-red-500/20 flex flex-col md:flex-row items-center justify-between gap-8"
        >
          <div className="max-w-xl text-center md:text-left">
            <h2 className="text-3xl md:text-4xl font-black mb-4 uppercase tracking-tighter">¿Necesitas una herramienta personalizada?</h2>
            <p className="text-zinc-400 font-medium">Únete a nuestro Discord y cuéntanos tu idea. Desarrollamos soluciones a medida para la comunidad.</p>
          </div>
          <Link href="https://discord.gg/lhcds" className="btn-pill btn-red px-10 py-5 text-sm font-black flex items-center gap-3 shadow-[0_0_30px_rgba(234,179,8,0.2)]">
            <User size={18} /> {t('unete_discord')}
          </Link>
        </motion.div>
      </main>

      <Footer />
      
      <style jsx global>{`
        .animate-spin-slow {
          animation: spin 8s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
