'use client';

import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { useState } from 'react';
import { Check, Shield, Zap, ShoppingCart } from 'lucide-react';
import Link from 'next/link';

export default function PremiumPage() {
  const [activeTab, setActiveTab] = useState('OPTI');

  const tabs = [
    { id: 'OPTI', label: 'OPTIMIZACIÓN', icon: <Zap size={16} /> },
    { id: 'SHOP', label: 'TIENDA EXTRA', icon: <ShoppingCart size={16} /> },
    { id: 'MODDING', label: 'PREMIUM MODDING', icon: <Shield size={16} /> },
  ];

  const services = {
    OPTI: [
      { name: 'OPTI ESSENTIAL', price: '7€', features: ['Aumento de FPS', 'Optimización Windows', 'Configuración Nvidia', 'Soporte Básico'] },
      { name: 'OPTI ADVANCED', price: '14€', features: ['Aumento de FPS', 'Optimización Windows', 'Configuración Nvidia', 'Plan de energía optimizado', 'Soporte AMD'], popular: true },
      { name: 'OPTI PERFORMANCE', price: '22€', features: ['Aumento de FPS', 'Optimización Windows', 'Configuración Nvidia', 'Plan de energía optimizado', 'Soporte AMD', 'Ajustes de registro avanzados', 'Optimización de BIOS'] },
    ],
    SHOP: [
      { name: 'PACK ARMAS GOLD', price: '10€', features: ['10 armas exclusivas', 'Texturas 4K', 'Sonidos realistas', 'Instalación fácil'] },
      { name: 'CLOTHING PACK', price: '15€', features: ['50 prendas nuevas', 'E-girl & E-boy styles', 'Optimizado para FiveM'] },
    ],
    MODDING: [
      { name: 'CURSO CONVERSIÓN', price: '30€', features: ['Aprende desde cero', 'Acceso a herramientas pro', 'Soporte 1 a 1', 'Certificado LHC'] },
    ]
  };

  return (
    <>
      <Header />
      <main className="new-layout-container" style={{ paddingTop: '80px', paddingBottom: '100px' }}>
        <div style={{ textAlign: 'center', marginBottom: '60px' }}>
          <h1 style={{ fontSize: '48px', fontWeight: '900', marginBottom: '20px' }}>SERVICIOS <span style={{ color: 'var(--accent-gold)' }}>LHC</span></h1>
          <p style={{ color: 'var(--text-secondary)', maxWidth: '600px', margin: '0 auto', lineHeight: '1.6' }}>
            Mejora tu rendimiento, consigue extras para tu cuenta o desbloquea herramientas profesionales de modding. 
            Todo con soporte garantizado en nuestro Discord.
          </p>
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', gap: '15px', marginBottom: '50px' }}>
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`btn-secondary ${activeTab === tab.id ? 'active' : ''}`}
              style={{ 
                borderRadius: '50px', 
                padding: '12px 25px',
                borderColor: activeTab === tab.id ? 'var(--accent-gold)' : 'var(--border-color)',
                background: activeTab === tab.id ? 'rgba(255, 179, 0, 0.1)' : 'rgba(255,255,255,0.03)',
                color: activeTab === tab.id ? 'var(--accent-gold)' : 'var(--text-secondary)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                {tab.icon} {tab.label}
              </div>
            </button>
          ))}
        </div>

        <div className="pricing-grid">
          {services[activeTab].map((service, idx) => (
            <div key={idx} className={`pricing-card ${service.popular ? 'popular' : ''}`}>
              <div className="pricing-header">
                <h3>{service.name}</h3>
                <div className="pricing-price">{service.price}</div>
              </div>
              
              <ul className="pricing-features">
                {service.features.map((feat, fIdx) => (
                  <li key={fIdx}>
                    <Check size={16} className="check-icon" /> {feat}
                  </li>
                ))}
              </ul>

              <a href="https://discord.gg/AS46Hlp2vO" target="_blank" rel="noopener noreferrer" className="btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
                Comprar / Contactar
              </a>
            </div>
          ))}
        </div>

        <div style={{ textAlign: 'center', marginTop: '60px' }}>
          <p style={{ color: 'var(--text-tertiary)', fontSize: '13px' }}>
            LhcTools © 2024 · Discord · <Link href="/" style={{ textDecoration: 'underline' }}>Volver a herramientas</Link>
          </p>
        </div>
      </main>
      <Footer />
    </>
  );
}
