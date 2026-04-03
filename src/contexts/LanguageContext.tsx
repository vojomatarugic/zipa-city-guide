import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type Language = 'sr' | 'en';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => {
    try {
      const saved = localStorage.getItem('blg-language');
      return (saved === 'sr' || saved === 'en') ? saved : 'sr';
    } catch {
      return 'sr';
    }
  });

  // Sačuvaj jezik u localStorage kada se promeni
  useEffect(() => {
    try {
      localStorage.setItem('blg-language', language);
    } catch {
      // Ignore localStorage errors in SSR/build environments
    }
  }, [language]);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage }}>
      {children}
    </LanguageContext.Provider>
  );
}

// Hook za pristup language context-u
export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}

// Hook za jednostavan pristup prevodima
export function useTranslation() {
  const { language } = useLanguage();
  
  return {
    language,
    t: (key: string, translationObject?: Record<string, string>) => {
      if (translationObject) {
        return translationObject[language] || translationObject['sr'] || key;
      }
      return key;
    }
  };
}