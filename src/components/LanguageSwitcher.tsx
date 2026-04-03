import { useLanguage } from '../contexts/LanguageContext';

interface LanguageSwitcherProps {
  currentPage?: string;
}

export function LanguageSwitcher({ currentPage }: LanguageSwitcherProps) {
  const { language, setLanguage } = useLanguage();
  const isHomePage = currentPage === 'home';

  const toggleLanguage = () => {
    setLanguage(language === 'sr' ? 'en' : 'sr');
  };

  return (
    <button
      onClick={toggleLanguage}
      className="flex items-center justify-center rounded-lg transition-all duration-200 hover:bg-[#0E3DC5] hover:text-white group"
      style={{ 
        background: 'white',
        width: '32px',
        height: '32px',
        fontSize: '15px',
        fontWeight: 700,
        color: '#0E3DC5',
        letterSpacing: '-0.5px',
        cursor: 'pointer'
      }}
    >
      {language === 'sr' ? 'SR' : 'EN'}
    </button>
  );
}