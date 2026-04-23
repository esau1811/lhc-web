'use client';

import Header from '@/components/Header';
import Footer from '@/components/Footer';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { Check } from 'lucide-react';

export default function HomePage() {
  const [activeTab, setActiveTab] = useState('Todas');
  const [toast, setToast] = useState(null);
  const [discordStats, setDiscordStats] = useState({ total: '10K+', online: '99.9%' });

  useEffect(() => {
    fetch('https://discord.com/api/v9/invites/AS46Hlp2vO?with_counts=true')
      .then(res => res.json())
      .then(data => {
        if (data && data.approximate_member_count) {
          setDiscordStats({
            total: (data.approximate_member_count / 1000).toFixed(1) + 'K+',
            online: data.approximate_presence_count
          });
        }
      })
      .catch(err => console.log('Error fetching discord stats', err));
  }, []);

  const categories = [
    { id: 'Todas', icon: '⊞' },
    { id: 'Optimización', icon: '⚡' },
    { id: 'Personalización', icon: '🎨' },
    { id: 'Utilidades', icon: '🛠️' },
    { id: 'Comunidad', icon: '👥' },
  ];

  const tools = [
    { id: 'converter', title: 'LHCConverter', desc: 'Convierte y optimiza tus armas. Compatible con +50 juegos', icon: '🔫', badge: 'GRATIS', badgeColor: 'green', users: '5.2K', rating: '4.8', category: 'Utilidades', href: '/converter' },
    { id: 'sound', title: 'LHCSound', desc: 'Personaliza sonidos y efectos. Biblioteca de +1000 sonidos', icon: '🎵', badge: 'PRONTO', badgeColor: 'purple', users: '3.1K', rating: '4.6', category: 'Personalización', href: '/sound' },
    { id: 'resolution', title: 'LHCResolution', desc: 'Optimiza tu experiencia visual. Perfiles para cada sistema', icon: '🖥️', badge: 'PREMIUM', badgeColor: 'purple', users: '2.8K', rating: '4.9', category: 'Optimización', href: '/resolution' },
    { id: 'trainer', title: 'LHCTrainer', desc: 'Herramientas de entrenamiento. Mejora tus habilidades', icon: '🎯', badge: 'PREMIUM', badgeColor: 'purple', users: '1.9K', rating: '4.7', category: 'Utilidades', href: '#' },
  ];

  const filteredTools = activeTab === 'Todas' ? tools : tools.filter(t => t.category === activeTab);

  return (
    <>
      <Header />
      
      <main className="new-layout-container">
        
        {/* HERO SECTION */}
        <section className="hero-new">
          <div className="hero-image-bg">
            <img src="/hero.png" alt="LHC Soldier" />
            <div className="hero-gradient-overlay"></div>
          </div>

          <div className="hero-content-wrapper">
            <div className="hero-left-col">
              <h1 className="hero-new-title">ELEVA TU<br/><span>EXPERIENCIA</span></h1>
              <p className="hero-new-desc">Herramientas premium para jugadores que<br/>buscan más. Optimiza, personaliza y domina.</p>
              
              <div className="hero-new-buttons">
                <Link href="#tools" className="btn-primary">
                  🚀 Explorar Herramientas
                </Link>
                <Link href="/premium" className="btn-secondary">
                  👑 Ver Beneficios Premium
                </Link>
              </div>

              <div className="hero-stats">
                <div className="stat-item">
                  <div className="stat-item-value">👥 {discordStats.total}</div>
                  <div className="stat-item-label">Usuarios Activos</div>
                </div>
                <div className="stat-item">
                  <div className="stat-item-value">🛠️ 25+</div>
                  <div className="stat-item-label">Herramientas</div>
                </div>
                <div className="stat-item">
                  <div className="stat-item-value">⚡ 99.9%</div>
                  <div className="stat-item-label">Tiempo Activo</div>
                </div>
                <div className="stat-item">
                  <div className="stat-item-value">🎧 24/7</div>
                  <div className="stat-item-label">Soporte</div>
                </div>
              </div>
            </div>

            <div className="hero-right-col">
              <div className="premium-box">
                <div className="premium-box-header">
                  <span className="crown-icon">👑</span>
                  <h3>PREMIUM</h3>
                </div>
                <p className="premium-box-desc">Desbloquea todo el potencial</p>
                <ul className="premium-features-list">
                  <li><Check size={14} className="check-icon" /> Acceso a herramientas exclusivas</li>
                  <li><Check size={14} className="check-icon" /> Actualizaciones prioritarias</li>
                  <li><Check size={14} className="check-icon" /> Soporte VIP 24/7</li>
                  <li><Check size={14} className="check-icon" /> Sin anuncios</li>
                </ul>
                <Link href="/premium" className="btn-premium-upgrade">
                  👑 Mejorar a Premium
                </Link>
                <div className="premium-price-hint">Desde $4.99/mes</div>
              </div>
            </div>
          </div>
        </section>

        {/* MAIN CONTENT GRID */}
        <section className="main-grid" id="tools">
          
          {/* LEFT SIDEBAR */}
          <aside className="left-sidebar">
            <div className="sidebar-menu">
              <div className="sidebar-title">CATEGORÍAS</div>
              {categories.map(cat => (
                <div 
                  key={cat.id} 
                  className={`sidebar-item ${activeTab === cat.id ? 'active' : ''}`}
                  onClick={() => setActiveTab(cat.id)}
                >
                  <span className="sidebar-icon">{cat.icon}</span> {cat.id}
                </div>
              ))}
            </div>

            <a href="https://discord.gg/AS46Hlp2vO" target="_blank" rel="noopener noreferrer" className="discord-join-card">
              <div className="discord-icon-wrapper">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="white"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z" /></svg>
              </div>
              <div className="discord-text">
                <div className="discord-title">ÚNETE A DISCORD</div>
                <div className="discord-subtitle">Comunidad activa</div>
              </div>
              <div className="discord-arrow">›</div>
            </a>
          </aside>

          {/* CENTER CONTENT */}
          <div className="content-area">
            <div className="content-header">
              <div className="content-title">⚡ HERRAMIENTAS DESTACADAS</div>
              <Link href="#" className="view-all">Ver todas →</Link>
            </div>
            
            <div className="cards-grid">
              {filteredTools.map(tool => (
                <Link href={tool.href} key={tool.id} className="new-tool-card">
                  <div className="new-tool-card-header">
                    <div className="new-tool-icon" style={tool.id === 'converter' ? {color: '#2ecc71', textShadow: '0 0 15px rgba(46,204,113,0.5)'} : tool.id === 'sound' ? {color: '#9b59b6', textShadow: '0 0 15px rgba(155,89,182,0.5)'} : tool.id === 'resolution' ? {color: '#3498db', textShadow: '0 0 15px rgba(52,152,219,0.5)'} : {color: '#f1c40f', textShadow: '0 0 15px rgba(241,196,15,0.5)'}}>
                      {tool.icon}
                    </div>
                    <div className={`new-tool-badge badge-${tool.badgeColor}`}>{tool.badge}</div>
                  </div>
                  <div className="new-tool-content">
                    <h3 className="new-tool-title">{tool.title}</h3>
                    <p className="new-tool-desc">{tool.desc}</p>
                  </div>
                  <div className="new-tool-footer">
                    <span>👥 {tool.users}</span>
                    <span style={{ color: 'var(--accent-gold)' }}>★ {tool.rating}</span>
                  </div>
                </Link>
              ))}
            </div>

            <div className="community-banner">
              <div className="community-banner-left">
                <div className="banner-trophy">🏆</div>
                <div className="banner-content">
                  <h3>ÚNETE A MILES DE JUGADORES</h3>
                  <p>Forma parte de la comunidad #1 en herramientas para gamers</p>
                </div>
              </div>
              <div className="banner-right">
                <div className="members-avatars">
                  <img src="https://i.pravatar.cc/100?img=1" alt="user" />
                  <img src="https://i.pravatar.cc/100?img=2" alt="user" />
                  <img src="https://i.pravatar.cc/100?img=3" alt="user" />
                  <img src="https://i.pravatar.cc/100?img=4" alt="user" />
                </div>
                <div className="members-count">
                  {discordStats.total}
                  <span>Miembros activos</span>
                </div>
                <a href="https://discord.gg/AS46Hlp2vO" target="_blank" rel="noopener noreferrer" className="btn-primary" style={{ padding: '8px 20px', borderRadius: '8px' }}>
                  Únete ahora →
                </a>
              </div>
            </div>
          </div>

          {/* RIGHT SIDEBAR */}
          <aside className="right-sidebar">
            <div className="sidebar-title" style={{ paddingLeft: 0, marginBottom: '16px' }}>ACTIVIDAD RECIENTE</div>
            
            <div className="activity-list">
              <div className="activity-item">
                <div className="activity-icon" style={{color: '#2ecc71'}}>🔫</div>
                <div className="activity-content">
                  <div className="activity-title">LHCConverter</div>
                  <div className="activity-desc">Actualizado v2.1.4</div>
                </div>
                <div className="activity-time">Hace 2h</div>
              </div>
              
              <div className="activity-item">
                <div className="activity-icon" style={{color: '#9b59b6'}}>🎵</div>
                <div className="activity-content">
                  <div className="activity-title">LHCSound</div>
                  <div className="activity-desc">Nueva biblioteca</div>
                </div>
                <div className="activity-time">Hace 4h</div>
              </div>
              
              <div className="activity-item">
                <div className="activity-icon" style={{color: '#3498db'}}>🖥️</div>
                <div className="activity-content">
                  <div className="activity-title">LHCResolution</div>
                  <div className="activity-desc">Perfil agregado</div>
                </div>
                <div className="activity-time">Hace 6h</div>
              </div>

              <div className="activity-item">
                <div className="activity-icon" style={{color: '#f1c40f'}}>👤</div>
                <div className="activity-content">
                  <div className="activity-title">Nuevo usuario</div>
                  <div className="activity-desc">Se unió a la comunidad</div>
                </div>
                <div className="activity-time">Hace 8h</div>
              </div>
            </div>

            <div className="status-indicator">
              <div className="status-dot"></div>
              <div className="status-text">
                TODOS LOS SISTEMAS<br/>
                <span>Operativo</span>
              </div>
            </div>
          </aside>

        </section>

      </main>

      <Footer />
    </>
  );
}
