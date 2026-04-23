'use client';

import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { useState, useEffect, Suspense } from 'react';
import { Check, Shield, Zap, ShoppingCart } from 'lucide-react';
import Link from 'next/link';
import GlassCard from '@/components/GlassCard';
import { motion, AnimatePresence } from 'framer-motion';
import { useSearchParams } from 'next/navigation';

function PremiumContent() {
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState('OPTI');

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab && (tab === 'OPTI' || tab === 'SHOP')) {
      setActiveTab(tab);
      
      // Manual scroll after tab switch
      setTimeout(() => {
        const hash = window.location.hash;
        if (hash) {
          const id = hash.replace('#', '');
          const element = document.getElementById(id);
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }
      }, 100);
    }
  }, [searchParams]);

  const tabs = [
    { id: 'OPTI', label: 'OPTIMIZACIÓN', icon: <Zap size={16} /> },
    { id: 'SHOP', label: 'TIENDA EXTRA', icon: <ShoppingCart size={16} /> },
  ];

  const services = {
    OPTI: [
      { name: 'OPTI ESSENTIAL', price: '7€', features: ['Aumento de FPS', 'Optimización Windows', 'Configuración Nvidia', 'Soporte Básico'] },
      { name: 'OPTI ADVANCED', price: '14€', features: ['Aumento de FPS', 'Optimización Windows', 'Configuración Nvidia', 'Plan de energía optimizado', 'Soporte AMD'], popular: true },
      { name: 'OPTI PERFORMANCE', price: '22€', features: ['Aumento de FPS', 'Optimización Windows', 'Configuración Nvidia', 'Plan de energía optimizado', 'Soporte AMD', 'Ajustes de registro avanzados', 'Optimización de BIOS'] },
    ],
    SHOP: [
      { name: 'NITRO BASIC', price: '1.50€', features: ['Insignia Basic', 'Archivos 50MB', 'Emojis personalizados', 'Uso global'] },
      { name: 'X14 SERVER BOOSTS', price: '4€', features: ['Nivel 3 Instantáneo', '3 meses de duración', 'Entrega inmediata', 'Soporte 24/7'] },
      { name: 'NITRO BOOST (LEGAL)', price: '4.30€', features: ['2 Boosts incluidos', 'Insignia de Nitro', 'Streaming 4K', 'Emojis animados'], popular: true },
    ]
  };

  return (
    <div className="min-h-screen">
      <Header />
      <main className="max-w-7xl mx-auto px-6 pt-32 pb-32">
        
        <div className="text-center mb-20">
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-5xl md:text-7xl font-black mb-6 tracking-tighter"
          >
            SERVICIOS <span className="bg-clip-text text-transparent bg-gradient-to-r from-yellow-400 to-orange-500">LHC</span>
          </motion.h1>
          <p className="text-zinc-400 max-w-2xl mx-auto text-lg">
            Mejora tu rendimiento, consigue extras para tu cuenta o desbloquea herramientas profesionales de modding.
          </p>
        </div>

        <div className="flex flex-wrap justify-center gap-4 mb-16">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`btn-pill border ${
                activeTab === tab.id 
                ? 'bg-yellow-500/10 border-yellow-500 text-yellow-500' 
                : 'bg-white/5 border-white/10 text-zinc-400 hover:text-white hover:bg-white/10'
              }`}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>

        <div id="content" className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <AnimatePresence mode="wait">
            {services[activeTab].map((service, idx) => (
              <motion.div
                key={`${activeTab}-${idx}`}
                id={`${activeTab.toLowerCase()}-${idx}`}
                style={{ scrollMarginTop: '120px' }}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2, delay: idx * 0.1 }}
              >
                <GlassCard className={`p-8 h-full flex flex-col group ${service.popular ? 'ring-1 ring-yellow-500/50' : ''}`}>
                  {service.popular && (
                    <div className="absolute top-4 right-4 bg-yellow-500 text-black text-[10px] font-black px-3 py-1 rounded-full">
                      POPULAR
                    </div>
                  )}
                  <div className="mb-8 flex justify-between items-start">
                    <div>
                      <h3 className="text-zinc-400 font-bold text-xs tracking-widest uppercase mb-2">{service.name}</h3>
                      <div className="text-5xl font-black">{service.price}</div>
                    </div>
                    <img 
                      src={activeTab === 'OPTI' ? '/opti_v2.png' : (service.name.includes('BOOSTS') ? '/boost_v2.png' : '/nitro_v2.png')} 
                      alt="Icon" 
                      className={`w-20 h-20 object-contain ai-icon-blend opacity-40 group-hover:opacity-100 transition-all duration-500 ${
                        activeTab === 'SHOP' ? (service.name.includes('BOOSTS') ? 'boost-glow' : 'nitro-glow') : ''
                      }`} 
                    />
                  </div>
                  
                  <ul className="space-y-4 mb-12 flex-1">
                    {service.features.map((feat, fIdx) => (
                      <li key={fIdx} className="flex items-center gap-3 text-sm text-zinc-300">
                        <Check size={16} className="text-yellow-500" /> {feat}
                      </li>
                    ))}
                  </ul>

                  <a 
                    href="https://discord.gg/AS46Hlp2vO" 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="btn-pill btn-gold w-full"
                  >
                    Comprar ahora
                  </a>
                </GlassCard>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

      </main>
      <Footer />
    </div>
  );
}

export default function PremiumPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#050505]" />}>
      <PremiumContent />
    </Suspense>
  );
}
