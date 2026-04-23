'use client';

import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { useState } from 'react';
import { Check, Shield, Zap, Server } from 'lucide-react';

export default function PremiumPage() {
  const [activeTab, setActiveTab] = useState('OPTI');

  const tabs = [
    { id: 'OPTI', label: 'OPTIMIZACIÓN' },
    { id: 'SHOP', label: 'TIENDA EXTRA' },
    { id: 'PREMIUM', label: 'PREMIUM MODDING' }
  ];

  const optiPlans = [
    {
      title: 'OPTI ESSENTIAL',
      price: '7€',
      features: ['Aumento de FPS', 'Optimización Windows', 'Configuración Nvidia', 'Soporte Básico'],
      popular: false
    },
    {
      title: 'OPTI ADVANCED',
      price: '14€',
      features: ['Aumento de FPS', 'Optimización Windows', 'Configuración Nvidia', 'Plan de energía optimizado', 'Soporte AMD'],
      popular: true
    },
    {
      title: 'OPTI PERFORMANCE',
      price: '22€',
      features: ['Aumento de FPS', 'Optimización Windows', 'Configuración Nvidia', 'Plan de energía optimizado', 'Soporte AMD', 'Ajustes de registro avanzados', 'Optimización de BIOS'],
      popular: false
    }
  ];

  const shopPlans = [
    {
      title: 'Nitro Basic',
      price: '1.50€',
      features: ['Insignia en perfil', 'Emojis personalizados', 'Fondos básicos'],
      popular: false
    },
    {
      title: 'Nitro Boost',
      price: '4.30€',
      features: ['Todo lo de Basic', '2 Mejoras de servidor', 'Calidad HD en streams', 'Subida 500MB', 'Legal 100%'],
      popular: true
    },
    {
      title: 'x14 Boost Server',
      price: '4€',
      features: ['Nivel 3 en servidor', 'URL Personalizada', 'Más emojis', 'Calidad de audio premium'],
      popular: false
    }
  ];

  const moddingPlans = [
    {
      title: 'Suscripción 1 Mes',
      price: 'Consultar',
      features: ['Acceso a RPF Converter', 'Soporte prioritario', 'Sin anuncios'],
      popular: false
    },
    {
      title: 'Suscripción 3 Meses',
      price: 'Consultar',
      features: ['Todo lo del mes', 'Ahorro del 15%', 'Acceso a betas', 'Rol especial en Discord'],
      popular: true
    },
    {
      title: 'Licencia Lifetime',
      price: 'Consultar',
      features: ['Pago único', 'Acceso de por vida', 'Herramientas privadas', 'Soporte 24/7 directo', 'Rol VIP en Discord'],
      popular: false
    }
  ];

  const renderPlans = (plans) => (
    <div className="cards-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '32px', marginTop: '32px' }}>
      {plans.map(plan => (
        <div key={plan.title} className={`pricing-card ${plan.popular ? 'popular' : ''}`}>
          <div className="pricing-header">
            <h3>{plan.title}</h3>
            <div className="pricing-price">{plan.price}</div>
          </div>
          <ul className="pricing-features">
            {plan.features.map(f => (
              <li key={f}><Check /> {f}</li>
            ))}
          </ul>
          <a href="https://discord.gg/AS46Hlp2vO" target="_blank" rel="noopener noreferrer" className={plan.popular ? 'btn-primary' : 'btn-secondary'} style={{ justifyContent: 'center' }}>
            Comprar / Contactar
          </a>
        </div>
      ))}
    </div>
  );

  return (
    <>
      <Header />
      <main className="new-layout-container" style={{ paddingTop: '64px', paddingBottom: '64px' }}>
        <div style={{ textAlign: 'center', marginBottom: '48px' }}>
          <h1 className="hero-new-title" style={{ fontSize: '42px', marginBottom: '16px' }}>SERVICIOS <span>LHC</span></h1>
          <p className="hero-new-desc" style={{ margin: '0 auto', maxWidth: '600px' }}>
            Mejora tu rendimiento, consigue extras para tu cuenta o desbloquea herramientas profesionales de modding. Todo con soporte garantizado en nuestro Discord.
          </p>
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', marginBottom: '48px' }}>
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={activeTab === tab.id ? 'btn-primary' : 'btn-secondary'}
              style={{ padding: '8px 24px', borderRadius: '100px' }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'OPTI' && renderPlans(optiPlans)}
        {activeTab === 'SHOP' && renderPlans(shopPlans)}
        {activeTab === 'PREMIUM' && renderPlans(moddingPlans)}

      </main>
      <Footer />
    </>
  );
}
