import './globals.css';
import SessionProvider from '@/components/SessionProvider';
import { LangProvider } from '@/components/LangProvider';
import { Analytics } from '@vercel/analytics/next';

export const metadata = {
  title: 'LHC — GTA V Weapon Skin Converter for FiveM',
  description: 'Free online tool to convert GTA V weapon skins (.rpf) for FiveM. Auto-detect weapons, convert between any variant.',
  keywords: 'GTA V, FiveM, weapon skins, RPF converter, LHC, weapon converter',
};

import InteractiveBackground from '@/components/InteractiveBackground';

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <head>
        <link rel="icon" href="/logo.png" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet" />
      </head>
      <body className="antialiased overflow-x-hidden bg-[#050505]">
        <InteractiveBackground />
        {/* Background Blobs */}
        <div className="blob-orange"></div>
        <div className="blob-gold"></div>
        
        <SessionProvider>
          <LangProvider>
            {children}
          </LangProvider>
        </SessionProvider>
        <Analytics />
      </body>
    </html>
  );
}
