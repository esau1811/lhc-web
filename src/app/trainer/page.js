'use client';

import dynamic from 'next/dynamic';
import Header from '@/components/Header';

// We load the trainer component with SSR disabled to prevent 3D engine errors during pre-rendering
const TrainerClient = dynamic(() => import('./TrainerClient'), { 
  ssr: false,
  loading: () => (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="text-center">
        <div className="w-16 h-16 border-4 border-red-500/20 border-t-red-500 rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-zinc-500 font-black tracking-tighter uppercase text-sm">Cargando Motor 3D...</p>
      </div>
    </div>
  )
});

export default function TrainerPage() {
  return <TrainerClient />;
}
