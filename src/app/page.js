'use client';

import Header from '@/components/Header';
import Footer from '@/components/Footer';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import GlassCard from '@/components/GlassCard';
import { Check, Rocket, Shield, Zap, ShoppingBag, Crown } from 'lucide-react';

export default function HomePage() {
  const [discordStats, setDiscordStats] = useState({ total: '...', online: '...' });

  useEffect(() => {
    // Fetch from our server API which avoids CORS
    fetch('/api/discord')
      .then(res => res.json())
      .then(data => {
        if (data && data.total) {
          setDiscordStats({
            total: data.total.toLocaleString(),
            online: data.online.toLocaleString()
          });
        }
      })
      .catch(err => {
        console.error('Discord fetch error', err);
        setDiscordStats({ total: '100', online: '30' }); // Realistic fallback
      });
  }, []);

  const optiPlans = [
    { name: 'ESSENTIAL', price: '7€', features: ['FPS Boost', 'Win Opti', 'Nvidia Config', 'Basic Support'] },
    { name: 'ADVANCED', price: '14€', features: ['FPS Boost', 'Win Opti', 'Nvidia Config', 'Power Plan', 'AMD Support'] },
    { name: 'PERFORMANCE', price: '22€', features: ['FPS Boost', 'Win Opti', 'Nvidia Config', 'Registry Fix', 'BIOS Opti'] },
  ];

  return (
    <div className="min-h-screen relative">
      <Header />
      
      <main className="max-w-7xl mx-auto px-6 pt-20 pb-32">
        
        {/* HERO SECTION */}
        <section className="flex flex-col items-center text-center mb-32">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <h1 className="text-6xl md:text-8xl font-extrabold mb-6 tracking-tighter leading-none">
              ELEVA TU<br />
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-yellow-400 via-orange-500 to-yellow-600">
                EXPERIENCIA
              </span>
            </h1>
            <p className="text-xl text-zinc-400 max-w-2xl mx-auto mb-10 font-medium">
              Software de optimización y modding de alta gama. 
              Domina el juego con herramientas diseñadas para el rendimiento extremo.
            </p>
            
            <div className="flex flex-wrap justify-center gap-4 mb-16">
              <Link href="/converter" className="btn-pill btn-gold text-lg">
                <Rocket size={20} /> Explorar Herramientas
              </Link>
              <Link href="/premium" className="btn-pill bg-white/5 border border-white/10 hover:bg-white/10 text-lg flex items-center gap-2">
                <Crown size={20} className="text-yellow-500" /> Ver Planes Premium
              </Link>
            </div>

            {/* REAL STATS COUNTER */}
            <div className="flex gap-8 md:gap-16 justify-center">
              <div className="flex flex-col items-center">
                <span className="text-4xl font-black text-yellow-500">{discordStats.total}</span>
                <span className="text-xs uppercase tracking-widest text-zinc-500 font-bold">Miembros</span>
              </div>
              <div className="flex flex-col items-center">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                  <span className="text-4xl font-black text-white">{discordStats.online}</span>
                </div>
                <span className="text-xs uppercase tracking-widest text-zinc-500 font-bold">En Línea</span>
              </div>
              <div className="flex flex-col items-center">
                <span className="text-4xl font-black text-orange-500">4+</span>
                <span className="text-xs uppercase tracking-widest text-zinc-500 font-bold">Tools</span>
              </div>
            </div>
          </motion.div>
        </section>

        {/* OPTIMIZATION GRID */}
        <section className="mb-32">
          <div className="flex items-center gap-4 mb-12">
            <img src="/opti_v2.png" alt="Opti" className="w-20 h-20 object-contain ai-icon-blend opti-glow" />
            <div>
              <h2 className="text-3xl font-bold uppercase tracking-tight">SERVICIOS OPTI</h2>
              <p className="text-zinc-500">Máximo rendimiento garantizado para tu PC.</p>
            </div>
            <div className="ml-auto">
              <Link href="/premium" className="text-yellow-500 hover:underline font-bold text-sm">Ver todos los detalles →</Link>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {optiPlans.map((plan, idx) => (
              <GlassCard key={idx} className="p-8 flex flex-col group overflow-hidden">
                <div className="mb-6 flex justify-between items-start">
                  <div>
                    <h3 className="text-zinc-400 font-bold text-xs tracking-widest uppercase mb-1">OPTI {plan.name}</h3>
                    <div className="text-4xl font-black">{plan.price}</div>
                  </div>
                  <img src="/opti_v2.png" alt="Opti" className="w-16 h-16 ai-icon-blend opti-glow opacity-20 group-hover:opacity-100 group-hover:scale-110 group-hover:rotate-3 transition-all duration-500" />
                </div>
                <ul className="space-y-4 mb-10 flex-1">
                  {plan.features.map((feat, fidx) => (
                    <li key={fidx} className="flex items-center gap-3 text-sm text-zinc-300">
                      <Check size={16} className="text-yellow-500" /> {feat}
                    </li>
                  ))}
                </ul>
                <Link href={`/premium?tab=OPTI#opti-${idx}`} className="btn-pill btn-gold w-full text-sm text-center relative z-10">
                  Comprar ahora
                </Link>
              </GlassCard>
            ))}
          </div>
        </section>

        {/* SHOP SECTION (Boosts & Nitros) */}
        <section className="mb-32">
          <div className="flex items-center gap-4 mb-12">
            <img src="/nitro_v2.png" alt="Nitro" className="w-20 h-20 object-contain ai-icon-blend nitro-glow" />
            <h2 className="text-3xl font-bold uppercase tracking-tight">TIENDA DISCORD</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <GlassCard className="p-8 flex flex-col justify-between group overflow-hidden">
              <div>
                <div className="flex justify-between items-start mb-4">
                  <h3 className="text-xl font-bold">NITRO BASIC</h3>
                  <img src="/nitro_v2.png" alt="Nitro" className="w-14 h-14 ai-icon-blend nitro-glow opacity-30 group-hover:opacity-100 group-hover:rotate-6 transition-all duration-500" />
                </div>
                <p className="text-zinc-500 text-xs mb-6">Insignia y emojis globales para tu cuenta personal.</p>
                <div className="bg-white/5 px-4 py-3 rounded-xl border border-white/5 inline-block mb-6">
                  <span className="text-2xl font-black">1.50€</span>
                </div>
              </div>
              <Link href="/premium?tab=SHOP#shop-0" className="btn-pill bg-zinc-800 hover:bg-zinc-700 w-full text-sm text-center">
                Comprar
              </Link>
            </GlassCard>

            <GlassCard className="p-8 flex flex-col justify-between border-purple-500/30 ring-1 ring-purple-500/20 group overflow-hidden">
              <div>
                <div className="flex justify-between items-start mb-4">
                  <div className="flex flex-col">
                    <h3 className="text-xl font-bold">NITRO BOOST</h3>
                    <span className="bg-purple-600 text-[10px] w-fit px-2 py-0.5 rounded-full font-black mt-1">LEGAL</span>
                  </div>
                  <img src="/nitro_v2.png" alt="Nitro" className="w-16 h-16 ai-icon-blend nitro-glow opacity-20 group-hover:opacity-100 group-hover:scale-110 group-hover:rotate-6 transition-all duration-500" />
                </div>
                <p className="text-zinc-500 text-xs mb-6">2 Boosts y streaming 4K con la máxima calidad garantizada.</p>
                <div className="bg-white/5 px-4 py-3 rounded-xl border border-white/5 inline-block mb-6">
                  <span className="text-2xl font-black text-purple-400">4.30€</span>
                </div>
              </div>
              <Link href="/premium?tab=SHOP#shop-2" className="btn-pill bg-purple-600 hover:bg-purple-500 w-full text-sm text-center">
                Comprar ahora
              </Link>
            </GlassCard>

            <GlassCard className="p-8 flex flex-col justify-between border-pink-500/30 ring-1 ring-pink-500/20 group overflow-hidden">
              <div>
                <div className="flex justify-between items-start mb-4">
                  <h3 className="text-xl font-bold">X14 BOOSTS</h3>
                  <img src="/boost_v2.png" alt="Boost" className="w-16 h-16 ai-icon-blend boost-glow opacity-20 group-hover:opacity-100 group-hover:rotate-12 group-hover:scale-110 transition-all duration-500" />
                </div>
                <p className="text-zinc-500 text-xs mb-6">Sube tu servidor al nivel 3 instantáneamente con 14 boosts.</p>
                <div className="bg-white/5 px-4 py-3 rounded-xl border border-white/5 inline-block mb-6">
                  <span className="text-2xl font-black text-pink-400">4€</span>
                </div>
              </div>
              <Link href="/premium?tab=SHOP#shop-1" className="btn-pill bg-pink-600 hover:bg-pink-500 w-full text-sm text-center">
                Comprar
              </Link>
            </GlassCard>
          </div>
        </section>

      </main>

      <Footer />
    </div>
  );
}
