'use client';

import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { useLang } from '@/components/LangProvider';
import Link from 'next/link';
import GlassCard from '@/components/GlassCard';
import { motion } from 'framer-motion';
import { Monitor, AlertTriangle, ChevronLeft, ExternalLink, Shield, CheckCircle2, Zap } from 'lucide-react';

export default function ResolutionPage() {
  const { t } = useLang();

  const features = [
    { icon: <Monitor size={18} />, text: t('resShortcuts') },
    { icon: <Zap size={18} />, text: t('resAnySize') },
    { icon: <CheckCircle2 size={18} />, text: t('resOneClick') },
    { icon: <Shield size={18} />, text: t('resStretchable') },
  ];

  return (
    <div className="min-h-screen bg-[#050505]">
      <Header />
      
      <main className="max-w-4xl mx-auto px-6 pt-32 pb-32">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <GlassCard className="p-12 md:p-16 text-center relative overflow-hidden">
            {/* Background Glow */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-1 bg-gradient-to-r from-transparent via-red-500/50 to-transparent"></div>
            
            <div className="mb-8 flex justify-center">
              <div className="w-24 h-24 bg-red-500/5 rounded-3xl flex items-center justify-center border border-red-500/10 shadow-[0_0_50px_rgba(234,179,8,0.1)]">
                <Monitor size={48} className="text-red-500" />
              </div>
            </div>

            <h1 className="text-4xl md:text-6xl font-black mb-4 tracking-tighter uppercase">
              LHC<span className="text-red-500">RESOLUTION</span>
            </h1>

            <div className="inline-flex items-center gap-2 bg-red-500/10 border border-red-500/20 px-4 py-1.5 rounded-full text-[10px] font-black text-red-500 uppercase tracking-widest mb-8">
              <AlertTriangle size={12} /> {t('maintenance')}
            </div>

            <p className="text-zinc-400 text-lg md:text-xl max-w-2xl mx-auto mb-12 font-medium leading-relaxed">
              {t('resolutionMaintenanceDesc')}
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl mx-auto mb-12">
              {features.map((feature, i) => (
                <div key={i} className="flex items-center gap-4 bg-white/5 border border-white/5 p-4 rounded-2xl text-left hover:bg-white/10 transition-all group">
                  <div className="text-red-500 group-hover:scale-110 transition-transform">
                    {feature.icon}
                  </div>
                  <span className="text-sm font-bold text-zinc-300">{feature.text}</span>
                </div>
              ))}
            </div>

            <div className="flex flex-col md:flex-row items-center justify-center gap-4">
              <Link 
                href="https://discord.gg/lhcds" 
                className="btn-pill btn-red px-12 py-4 text-sm font-black flex items-center gap-2 w-full md:w-auto"
              >
                {t('getOnDiscord')} <ExternalLink size={16} />
              </Link>
              <Link 
                href="/" 
                className="btn-pill bg-white/5 border border-white/10 hover:bg-white/10 px-8 py-4 text-sm font-black flex items-center gap-2 text-zinc-400 hover:text-white w-full md:w-auto transition-all"
              >
                <ChevronLeft size={18} /> {t('backToToolsBtn')}
              </Link>
            </div>
          </GlassCard>

          <div className="mt-8 p-6 bg-red-500/5 border border-red-500/10 rounded-2xl flex gap-4 max-w-2xl mx-auto">
            <Shield size={24} className="text-red-500 shrink-0" />
            <p className="text-xs text-zinc-500 leading-relaxed font-medium">
              LHCResolution es una aplicación nativa para Windows que permite cambiar la resolución de tu monitor y de FiveM de forma instantánea sin necesidad de reiniciar el juego.
            </p>
          </div>
        </motion.div>
      </main>

      <Footer />
    </div>
  );
}
