'use client';

import { signIn } from 'next-auth/react';
import Header from '@/components/Header';
import { useLang } from '@/components/LangProvider';
import { Lock, ExternalLink } from 'lucide-react';
import { motion } from 'framer-motion';
import Link from 'next/link';

const DiscordIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.419 0 1.334-.947 2.419-2.157 2.419zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.419 0 1.334-.946 2.419-2.157 2.419z"/>
  </svg>
);

export default function ToolGate({ toolName = 'esta herramienta' }) {
  const { t } = useLang();

  return (
    <div className="min-h-screen bg-[#050505] text-white">
      <Header />
      <main className="max-w-xl mx-auto px-6 pt-32 pb-20 flex flex-col items-center text-center">

        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
          className="w-full"
        >
          {/* Lock icon */}
          <div className="relative mx-auto w-24 h-24 mb-8">
            <div className="absolute inset-0 bg-red-500/10 rounded-full blur-xl animate-pulse" />
            <div className="relative w-24 h-24 bg-white/5 rounded-full border border-white/10 flex items-center justify-center">
              <Lock className="text-red-500" size={36} />
            </div>
          </div>

          <h1 className="text-3xl font-black uppercase tracking-tight mb-3">
            {t('gate_title') || 'ACCESO RESTRINGIDO'}
          </h1>
          <p className="text-zinc-500 mb-2 font-medium">
            {t('gate_desc') || `Para usar ${toolName} debes iniciar sesión con Discord`}
            {` — ${toolName}`}.
          </p>
          <p className="text-zinc-600 text-sm mb-10">
            {t('gate_join') || 'Únete a nuestra comunidad en Discord para desbloquear todas las herramientas.'}
          </p>

          {/* Steps */}
          <div className="grid grid-cols-2 gap-3 mb-10 text-left">
            {[
              { num: '1', text: t('gate_step1') || 'Únete al servidor de Discord' },
              { num: '2', text: t('gate_step2') || 'Inicia sesión con tu cuenta' },
            ].map(s => (
              <div key={s.num} className="bg-white/5 border border-white/10 rounded-2xl p-4 flex items-start gap-3">
                <span className="w-6 h-6 bg-red-500/20 text-red-400 rounded-full flex items-center justify-center text-xs font-black flex-shrink-0">{s.num}</span>
                <p className="text-xs font-bold text-zinc-400">{s.text}</p>
              </div>
            ))}
          </div>

          {/* CTAs */}
          <div className="flex flex-col gap-3">
            <Link
              href="https://discord.gg/lhcds"
              target="_blank"
              className="flex items-center justify-center gap-3 bg-[#5865F2] hover:bg-[#4752c4] text-white font-black py-4 px-8 rounded-xl transition-all text-sm"
            >
              <DiscordIcon />
              {t('gate_join_btn') || 'Unirte al Discord'}
              <ExternalLink size={14} />
            </Link>

            <button
              onClick={() => signIn('discord')}
              className="flex items-center justify-center gap-3 bg-white/5 hover:bg-white/10 border border-white/10 text-white font-black py-4 px-8 rounded-xl transition-all text-sm"
            >
              <DiscordIcon />
              {t('gate_login_btn') || 'Iniciar sesión con Discord'}
            </button>
          </div>

          <p className="text-zinc-700 text-xs mt-8">
            {t('gate_already') || '¿Ya eres miembro? Haz clic en "Iniciar sesión" directamente.'}
          </p>
        </motion.div>
      </main>
    </div>
  );
}
