import './globals.css';
import SessionProvider from '@/components/SessionProvider';
import { LangProvider } from '@/components/LangProvider';

export const metadata = {
  title: 'LHC — GTA V Weapon Skin Converter for FiveM',
  description: 'Free online tool to convert GTA V weapon skins (.rpf) for FiveM. Auto-detect weapons, convert between any variant. Pistol, MK2, Combat, SNS and more.',
  keywords: 'GTA V, FiveM, weapon skins, RPF converter, LHC, weapon converter',
  openGraph: {
    title: 'LHC — GTA V Weapon Skin Converter',
    description: 'Convert .rpf weapon skins for FiveM automatically.',
    type: 'website',
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/favicon.ico" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body>
        <SessionProvider>
          <LangProvider>
            {children}
          </LangProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
