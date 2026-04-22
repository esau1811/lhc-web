'use client';

import { createContext, useContext, useState, useEffect } from 'react';
import { t } from '@/lib/i18n';

const LangContext = createContext();

export function LangProvider({ children }) {
  const [lang, setLang] = useState('en');

  useEffect(() => {
    const saved = localStorage.getItem('lhc_lang');
    if (saved && ['en', 'es', 'it', 'pt'].includes(saved)) {
      setLang(saved);
    }
  }, []);

  const changeLang = (newLang) => {
    setLang(newLang);
    localStorage.setItem('lhc_lang', newLang);
  };

  const tr = (key) => t(lang, key);

  return (
    <LangContext.Provider value={{ lang, changeLang, t: tr }}>
      {children}
    </LangContext.Provider>
  );
}

export function useLang() {
  const context = useContext(LangContext);
  if (!context) throw new Error('useLang must be used within LangProvider');
  return context;
}
