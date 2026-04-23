'use client';
// Refresh trigger for redeploy

import Header from '@/components/Header';
import Footer from '@/components/Footer';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import GlassCard from '@/components/GlassCard';
import { useLang } from '@/components/LangProvider';
import { useSession } from 'next-auth/react';
import { 
  Check, Rocket, Shield, Zap, ShoppingBag, Crown, 
  LayoutGrid, Settings, User, MessageSquare, ExternalLink,
  Clock, Activity, ChevronRight, Star, Monitor, Target, Music, Trophy
} from 'lucide-react';

export default function HomePage() {
  const { t, lang } = useLang();
  const { data: session } = useSession();
  const [discordStats, setDiscordStats] = useState({ total: '600+', online: '150+' });
  const [serverBoosts, setServerBoosts] = useState('35');
  const [activeCategory, setActiveCategory] = useState('Todas');

  useEffect(() => {
    const fetchDiscordStats = async () => {
      try {
        const res = await fetch('https://discord.com/api/v9/invites/lhcds?with_counts=true');
        const data = await res.json();
        if (data.approximate_member_count) {
          setDiscordStats({
            total: `${data.approximate_member_count}`,
            online: `${data.approximate_presence_count}`
          });
          if (data.guild?.premium_subscription_count) {
            setServerBoosts(data.guild.premium_subscription_count.toString());
          }
        }
      } catch (error) {
        console.error('Error fetching discord stats:', error);
      }
    };
    fetchDiscordStats();
    const interval = setInterval(fetchDiscordStats, 60000); // Update every minute
    return () => clearInterval(interval);
  }, []);

  const categories = [
    { name: 'Todas', displayName: t('cat_todas'), icon: LayoutGrid },
    { name: 'Optimización', displayName: t('cat_opti'), icon: Zap },
    { name: 'Tienda', displayName: t('cat_tienda'), icon: ShoppingBag },
    { name: 'Comunidad', displayName: t('cat_comunidad'), icon: User },
  ];

  const optiPlans = [
    { name: 'ESSENTIAL', price: '7€', features: ['FPS Boost', 'Win Opti', 'Nvidia Config', 'Basic Support'], icon: '/opti_v2.png', glow: 'opti-glow' },
    { name: 'ADVANCED', price: '14€', features: ['FPS Boost', 'Win Opti', 'Nvidia Config', 'Power Plan', 'AMD Support'], icon: '/opti_v2.png', glow: 'opti-glow' },
    { name: 'PERFORMANCE', price: '22€', features: ['FPS Boost', 'Win Opti', 'Nvidia Config', 'Registry Fix', 'BIOS Opti'], icon: '/opti_v2.png', glow: 'opti-glow' },
  ];

  const shopPlans = [
    { name: 'NITRO BASIC', price: '1.50€', desc: t('nitro_basic_desc') || 'Insignia y emojis globales.', icon: '/nitro_v2.png', glow: 'nitro-glow' },
    { name: 'NITRO BOOST', price: '4.30€', desc: t('nitro_boost_desc') || '2 Boosts y streaming 4K.', icon: '/nitro_v2.png', glow: 'nitro-glow' },
    { name: `X${serverBoosts} BOOSTS`, price: '4€', desc: t('boost_desc') || 'Sube tu servidor al nivel 3.', icon: '/boost_v2.png', glow: 'boost-glow' },
  ];

  const featuredTools = [
    { 
      id: 'converter',
      category: 'Todas',
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
      category: 'Todas',
      name: t('soundTitle'), 
      desc: t('soundDesc'), 
      icon: '/icon_sound.png', 
      badge: t('free'), 
      badgeColor: 'bg-green-500',
      glowClass: 'nitro-glow',
      users: '3.1K',
      rating: '4.6',
      link: '/sound'
    },
    { 
      id: 'res',
      category: 'Todas',
      name: t('resolutionTitle'), 
      desc: t('resolutionDesc'), 
      icon: '/icon_res.png', 
      badge: t('premium'), 
      badgeColor: 'bg-blue-500',
      glowClass: 'blue-glow',
      users: '2.8K',
      rating: '4.9',
      link: '/resolution'
    },
    { 
      id: 'train',
      category: 'Todas',
      name: 'LHCTrainer', 
      desc: t('trainerDesc') || 'Herramientas de entrenamiento. Mejora tus habilidades.', 
      icon: '/icon_train.png', 
      badge: t('premium'), 
      badgeColor: 'bg-yellow-500',
      glowClass: 'opti-glow',
      users: '1.5K',
      rating: '4.7',
      link: '/premium?tab=OPTI'
    },
  ];

  const recentActivity = [
    ...(session ? [{ name: session.user.name.split(' ')[0], action: t('act_joined') || 'Se unió a la comunidad', time: 'Ahora', isUser: true, image: session.user.image }] : []),
    { name: 'LHCConverter', action: t('act_updated') || 'Actualizado v2.1.4', time: t('time_2h') || 'Hace 2h', icon: '/icon_conv.png' },
    { name: 'LHCSound', action: t('act_new_lib') || 'Nueva biblioteca', time: t('time_4h') || 'Hace 4h', icon: '/icon_sound.png' },
    { name: 'LHCResolution', action: t('act_profile') || 'Perfil agregado', time: t('time_6h') || 'Hace 6h', icon: '/icon_res.png' },
  ];

  return (
    <div className="min-h-screen bg-[#050505] text-white selection:bg-yellow-500/30">
      <Header />
      
      <main className="max-w-[1400px] mx-auto px-6 pt-24 pb-20">
        
        {/* HERO SECTION DASHBOARD STYLE */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-10">
          
          {/* MAIN HERO CARD */}
          <div className="lg:col-span-9 relative overflow-hidden rounded-3xl bg-gradient-to-br from-zinc-900 to-black border border-white/5 p-6 md:p-12 min-h-[400px] md:min-h-[500px] flex items-center">
            {/* Background Glow */}
            <div className="absolute top-0 right-0 w-[300px] md:w-[600px] h-[300px] md:h-[600px] bg-yellow-500/10 blur-[80px] md:blur-[120px] rounded-full -mr-20 md:-mr-40 -mt-20 md:-mt-40"></div>
            
            <div className="relative z-10 w-full md:max-w-xl pb-16 md:pb-24">
              <motion.h1 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-4xl md:text-7xl font-black mb-6 leading-[0.9] tracking-tighter"
              >
                {t('eleva_tu')} <br />
                <span className="text-yellow-500">{t('experiencia')}</span>
              </motion.h1>
              <p className="text-zinc-400 text-sm md:text-lg mb-8 md:text-lg mb-10 max-w-md font-medium leading-relaxed">
                {t('hero_desc')}
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Link href="/converter" className="btn-pill btn-gold px-8 py-4 text-xs md:text-sm font-black flex items-center justify-center gap-2">
                  <Rocket size={18} /> {t('explorar_herramientas')}
                </Link>
                <Link href="/premium?tab=WEB" className="btn-pill bg-white/5 border border-white/10 hover:bg-white/10 px-8 py-4 text-xs md:text-sm font-black flex items-center justify-center gap-2">
                  <Crown size={18} /> {t('ver_beneficios')}
                </Link>
              </div>
            </div>


            {/* Stats Bar Integrated in Hero */}
            <div className="absolute bottom-4 left-6 md:left-12 flex flex-wrap md:flex-nowrap gap-4 md:gap-8 items-center bg-black/40 backdrop-blur-md md:bg-transparent p-4 md:p-0 rounded-2xl md:rounded-none border border-white/5 md:border-none">
              <div className="flex flex-col">
                <span className="text-sm md:text-xl font-black text-white">{discordStats.total}</span>
                <span className="text-[8px] md:text-[10px] uppercase tracking-widest text-zinc-500 font-bold">{t('usuarios')}</span>
              </div>
              <div className="hidden md:block w-[1px] h-8 bg-white/10"></div>
              <div className="flex flex-col">
                <span className="text-sm md:text-xl font-black text-orange-500">{discordStats.online}</span>
                <span className="text-[8px] md:text-[10px] uppercase tracking-widest text-zinc-500 font-bold">Online</span>
              </div>
              <div className="hidden md:block w-[1px] h-8 bg-white/10"></div>
              <div className="flex flex-col">
                <span className="text-sm md:text-xl font-black text-white">99.9%</span>
                <span className="text-[8px] md:text-[10px] uppercase tracking-widest text-zinc-500 font-bold">{t('uptime')}</span>
              </div>
              <div className="hidden md:block w-[1px] h-8 bg-white/10"></div>
              <div className="flex flex-col">
                <span className="text-sm md:text-xl font-black text-white">24/7</span>
                <span className="text-[8px] md:text-[10px] uppercase tracking-widest text-zinc-500 font-bold">{t('soporte')}</span>
              </div>
            </div>
          </div>

          {/* SIDE PREMIUM CARD */}
          <div className="lg:col-span-3 flex flex-col gap-6">
            <GlassCard className="p-6 md:p-8 border-yellow-500/20 bg-yellow-500/5 flex-1 relative overflow-hidden flex flex-col justify-between">
              <div className="absolute top-0 right-0 p-4 opacity-10">
                <div className="md:hidden"><Crown size={60} /></div>
                <div className="hidden md:block"><Crown size={80} /></div>
              </div>
              
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Crown size={16} className="text-yellow-500" />
                  <span className="text-[11px] font-black uppercase tracking-widest text-yellow-500">Premium</span>
                </div>
                <h3 className="text-xl md:text-2xl font-black mb-4 md:mb-6">{t('desbloquea_potencial')}</h3>
                <ul className="space-y-3 md:space-y-4 mb-6 md:mb-8">
                  {[
                    t('acc_exclusive'),
                    t('prior_updates'),
                    t('vip_support')
                  ].map((item, i) => (
                    <li key={i} className="flex items-center gap-3 text-[10px] md:text-xs font-bold text-zinc-300">
                      <Check size={14} className="text-yellow-500" /> {item || 'Premium feature'}
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <Link href="/premium?tab=WEB" className="w-full py-3 md:py-4 bg-yellow-500 text-black rounded-xl text-[10px] md:text-xs font-black flex items-center justify-center gap-2 hover:bg-yellow-400 transition-all shadow-[0_0_20px_rgba(234,179,8,0.3)]">
                  <Crown size={14} /> {t('mejora_premium')}
                </Link>
                <p className="text-center text-[9px] md:text-[10px] text-zinc-500 mt-4 font-bold uppercase tracking-tight">{t('desde')} $4.99/mes</p>
              </div>
            </GlassCard>
          </div>
        </section>

        {/* MAIN DASHBOARD CONTENT */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* LEFT SIDEBAR: CATEGORIES */}
          <div className="lg:col-span-2 space-y-8">
            <div className="overflow-x-auto pb-4 lg:pb-0 -mx-6 px-6 lg:mx-0 lg:px-0">
              <h4 className="hidden lg:block text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 mb-6 px-2">{t('categorias')}</h4>
              <nav className="flex lg:flex-col gap-2 lg:gap-1 min-w-max lg:min-w-0">
                {categories.map(cat => (
                  <button 
                    key={cat.name}
                    onClick={() => setActiveCategory(cat.name)}
                    className={`flex items-center gap-3 px-4 py-2 lg:py-3 rounded-xl text-[12px] md:text-[13px] font-bold transition-all whitespace-nowrap ${
                      activeCategory === cat.name ? 'bg-white/10 text-white' : 'text-zinc-500 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <cat.icon size={18} className={activeCategory === cat.name ? 'text-yellow-500' : ''} />
                    {cat.name}
                  </button>
                ))}
              </nav>
            </div>

            <div className="hidden lg:block">
              <Link href="https://discord.gg/lhcds" className="flex items-center justify-between bg-[#5865F2] hover:bg-[#4752c4] p-4 rounded-2xl transition-all group relative">
                <div className="flex items-center gap-3 relative z-10">
                  <div className="p-1">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="white">
                      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515a.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0a12.64 12.64 0 0 0-.617-1.25a.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057a19.9 19.9 0 0 0 5.993 3.03a.078.078 0 0 0 .084-.028a14.09 14.09 0 0 0 1.226-1.994a.076.076 0 0 0-.041-.106a13.107 13.107 0 0 1-1.872-.892a.077.077 0 0 1-.008-.128a10.2 10.2 0 0 0 .372-.292a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127a12.299 12.299 0 0 1-1.873.892a.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028a19.839 19.839 0 0 0 6.002-3.03a.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.955-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.419c0 1.334-.947 2.419-2.157 2.419zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.955-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.419c0 1.334-.946 2.419-2.157 2.419z"/>
                    </svg>
                  </div>
                  <div>
                    <p className="text-[11px] font-black uppercase leading-none text-white">{t('unete_discord')}</p>
                    <p className="text-[9px] font-bold text-white/70">{t('comunidad_activa')}</p>
                  </div>
                </div>
                <ChevronRight size={16} className="relative z-10 text-white group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>
          </div>

          {/* CENTER: DYNAMIC GRID */}
          <div className="lg:col-span-7">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <Zap size={20} className="text-yellow-500" />
                <h3 className="text-xl font-black uppercase tracking-tight">{activeCategory === 'Todas' ? t('herramientas_destacadas') : t(`cat_${activeCategory === 'Optimización' ? 'opti' : activeCategory === 'Tienda' ? 'tienda' : 'comunidad'}`)}</h3>
              </div>
              <Link href={activeCategory === 'Todas' ? '/converter' : '/premium'} className="text-xs font-bold text-zinc-500 hover:text-white flex items-center gap-1 transition-colors">
                {t('ver_todas')} <ChevronRight size={14} />
              </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* ALL TOOLS */}
              {activeCategory === 'Todas' && featuredTools.map((tool, idx) => (
                <Link key={idx} href={tool.link}>
                  <GlassCard className="p-6 group cursor-pointer hover:border-white/10 transition-all h-full">
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
                </Link>
              ))}

              {/* OPTIMIZATION PLANS */}
              {activeCategory === 'Optimización' && optiPlans.map((plan, idx) => (
                <Link key={idx} href={`/premium?tab=OPTI#opti-${idx}`}>
                  <GlassCard className="p-6 group cursor-pointer hover:border-white/10 transition-all h-full">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h4 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">OPTI {plan.name}</h4>
                        <p className="text-2xl font-black">{plan.price}</p>
                      </div>
                      <img src={plan.icon} className={`w-12 h-12 ai-icon-blend opacity-20 group-hover:opacity-100 group-hover:rotate-6 transition-all ${plan.glow}`} />
                    </div>
                    <ul className="space-y-2 mb-6">
                      {plan.features.slice(0, 3).map((f, fi) => (
                        <li key={fi} className="text-[11px] text-zinc-400 flex items-center gap-2">
                          <Check size={12} className="text-yellow-500" /> {f}
                        </li>
                      ))}
                    </ul>
                    <div className="btn-pill btn-gold py-2 text-[10px]">{t('ver_detalles')}</div>
                  </GlassCard>
                </Link>
              ))}

              {/* SHOP PLANS */}
              {activeCategory === 'Tienda' && shopPlans.map((plan, idx) => (
                <Link key={idx} href={`/premium?tab=SHOP#shop-${idx}`}>
                  <GlassCard className="p-6 group cursor-pointer hover:border-white/10 transition-all h-full">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h4 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">{plan.name}</h4>
                        <p className="text-2xl font-black">{plan.price}</p>
                      </div>
                      <img src={plan.icon} className={`w-12 h-12 ai-icon-blend opacity-20 group-hover:opacity-100 group-hover:rotate-6 transition-all ${plan.glow}`} />
                    </div>
                    <p className="text-[11px] text-zinc-400 mb-6">{plan.desc}</p>
                    <div className="btn-pill btn-gold py-2 text-[10px]">{t('ver_detalles')}</div>
                  </GlassCard>
                </Link>
              ))}

              {/* COMUNIDAD */}
              {activeCategory === 'Comunidad' && (
                <div className="col-span-full py-12 text-center border-2 border-dashed border-white/5 rounded-3xl">
                  <User size={40} className="mx-auto text-zinc-700 mb-4" />
                  <h4 className="text-lg font-black mb-2">{t('cat_comunidad')} LHC</h4>
                  <p className="text-zinc-500 text-sm mb-6">{t('discordJoinDesc')}</p>
                  <Link href="https://discord.gg/lhcds" className="btn-pill btn-gold inline-flex px-8">{t('unete_ahora')}</Link>
                </div>
              )}
            </div>

            {/* MOBILE DISCORD BUTTON */}
            <div className="lg:hidden mt-8">
              <Link href="https://discord.gg/lhcds" className="flex items-center justify-between bg-[#5865F2] p-6 rounded-3xl transition-all relative overflow-hidden">
                <div className="flex items-center gap-4 relative z-10">
                  <div className="bg-white/10 p-2 rounded-xl">
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="white">
                      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515a.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0a12.64 12.64 0 0 0-.617-1.25a.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057a19.9 19.9 0 0 0 5.993 3.03a.078.078 0 0 0 .084-.028a14.09 14.09 0 0 0 1.226-1.994a.076.076 0 0 0-.041-.106a13.107 13.107 0 0 1-1.872-.892a.077.077 0 0 1-.008-.128a10.2 10.2 0 0 0 .372-.292a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127a12.299 12.299 0 0 1-1.873.892a.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028a19.839 19.839 0 0 0 6.002-3.03a.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.955-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.419c0 1.334-.947 2.419-2.157 2.419zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.955-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.419c0 1.334-.946 2.419-2.157 2.419z"/>
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-black uppercase leading-none text-white">{t('unete_miles')}</p>
                    <p className="text-xs font-bold text-white/70 mt-1">{t('comunidad_activa')}</p>
                  </div>
                </div>
                <ChevronRight size={24} className="relative z-10 text-white" />
              </Link>
            </div>

            {/* BOTTOM BANNER */}
            <div className="mt-8 relative overflow-hidden rounded-3xl bg-gradient-to-br lg:bg-gradient-to-r from-yellow-500/10 to-transparent border border-yellow-500/10 p-6 md:p-8 flex flex-col lg:flex-row items-center justify-between gap-8 group">
              <div className="flex flex-col md:flex-row items-center gap-6 text-center md:text-left">
                <div className="bg-yellow-500/5 p-4 rounded-2xl text-yellow-500 border border-yellow-500/20 shadow-[0_0_30px_rgba(234,179,8,0.1)]">
                  <Trophy size={32} />
                </div>
                <div>
                  <h4 className="text-lg md:text-xl font-black uppercase tracking-tight leading-none mb-2">{t('unete_miles')}</h4>
                  <p className="text-xs md:text-sm text-zinc-500 font-bold">{t('forma_parte')}</p>
                </div>
              </div>
              <div className="flex items-center gap-8 w-full lg:w-auto justify-center lg:justify-end border-t lg:border-t-0 border-white/5 pt-6 lg:pt-0">
              <div className="flex flex-col items-center lg:items-end">
                <span className="text-xl font-black">{discordStats.total}</span>
                <span className="text-[10px] text-zinc-500 font-bold uppercase">{t('miembros')}</span>
              </div>
                <Link href="https://discord.gg/lhcds" className="bg-yellow-500 text-black px-8 py-3 rounded-xl text-xs font-black flex items-center gap-2 hover:bg-yellow-400 transition-all">
                  {t('unete_ahora')} <ArrowRight size={14} />
                </Link>
              </div>
            </div>
          </div>

          {/* RIGHT SIDEBAR: ACTIVITY & STATUS */}
          <div className="lg:col-span-3 space-y-6">
            <GlassCard className="p-6" hideBorder>
              <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 mb-6">{t('actividad_reciente')}</h4>
              <div className="space-y-6">
                {recentActivity.map((act, i) => (
                  <div key={i} className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center overflow-hidden">
                      {act.isUser ? (
                        <img src={act.image || "/logo.png"} className="w-full h-full object-cover" />
                      ) : (
                        <div className="p-2">
                          <img src={act.icon} className="w-full h-full object-contain ai-icon-blend opacity-40" />
                        </div>
                      )}
                    </div>
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
                  <p className="text-[11px] font-black uppercase tracking-wider">{t('todos_sistemas')}</p>
                  <p className="text-[10px] text-green-500 font-black uppercase tracking-wide">{t('operativo')}</p>
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
