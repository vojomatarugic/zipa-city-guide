import { useLanguage } from '../contexts/LanguageContext';
import { tr, translations } from '../utils/translations';

/**
 * Hook za pristup prevodima
 * Koristi postojeću tr() funkciju iz /utils/translations.ts
 */
export function useT() {
  const { language } = useLanguage();
  
  return {
    language,
    // Funkcija za prevod - koristi tr() iz translations.ts
    t: (key: keyof typeof translations) => tr(key, language),
    // Direktan pristup translation objektima
    translations
  };
}
