import { useState, useMemo } from 'react';
import { UtensilsCrossed, Calendar, Hotel, Building2, Coffee, Music2, MapPin, Search } from 'lucide-react';
import { useT } from '../hooks/useT';
import { useLocation as useSelectedCity } from '../contexts/LocationContext';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { listingDocumentTitle } from '../utils/documentTitle';

export function MapPage() {
  const { t } = useT();
  const { selectedCity } = useSelectedCity();
  const mapTitle = useMemo(
    () => listingDocumentTitle(t('map'), selectedCity),
    [t, selectedCity],
  );
  useDocumentTitle(mapTitle);
  
  const [selectedCategories, setSelectedCategories] = useState({
    'food-and-drink': true,
    attractions: true,
    hotels: true,
    apartments: true,
    cafes: true,
    clubs: true
  });

  const toggleCategory = (category: keyof typeof selectedCategories) => {
    setSelectedCategories(prev => ({
      ...prev,
      [category]: !prev[category]
    }));
  };

  const categories = [
    { key: 'food-and-drink' as const, icon: UtensilsCrossed, labelKey: 'foodAndDrink', color: '#FF6B35' },
    { key: 'attractions' as const, icon: MapPin, labelKey: 'attractions', color: '#E74C3C' },
    { key: 'hotels' as const, icon: Hotel, labelKey: 'hotelsMap', color: '#3498DB' },
    { key: 'apartments' as const, icon: Building2, labelKey: 'apartmentsMap', color: '#E67E22' },
    { key: 'cafes' as const, icon: Coffee, labelKey: 'cafesMap', color: '#27AE60' },
    { key: 'clubs' as const, icon: Music2, labelKey: 'clubsMap', color: '#9B59B6' }
  ];
  
  return (
    <div className="min-h-full flex flex-col w-full" style={{ background: 'var(--bg-secondary)' }}>
      {/* MAP WITH SIDEBAR */}
      <div className="flex-1 w-full max-w-[1280px] mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-5" style={{ height: 'calc(100vh - 180px)' }}>
          
          {/* MAP */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <iframe 
              src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d181255.31919555535!2d17.041359401581413!3d44.77847378885453!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x475e03062ccd6b05%3A0x73fe3280dfee195d!2s78000%20Banja%20Luka!5e0!3m2!1sen!2sba!4v1765382492716!5m2!1sen!2sba" 
              width="100%" 
              height="100%" 
              style={{ border: 0 }}
              allowFullScreen 
              loading="lazy" 
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>

          {/* SIDEBAR - FILTERS */}
          <aside className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 overflow-y-auto">
            
            {/* SEARCH */}
            <div className="mb-6">
              <h2 className="mb-3" style={{ textShadow: '0 2px 4px rgba(0, 0, 0, 0.1)' }}>{t('searchLocations')}</h2>
              <div className="relative">
                <input
                  type="text"
                  placeholder={t('searchPlaceholder')}
                  className="w-full px-4 py-2.5 pl-10 rounded-lg border border-gray-200 text-[14px]"
                  style={{ color: 'var(--text-primary)' }}
                />
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-muted)' }} />
              </div>
            </div>

            {/* CATEGORIES */}
            <div>
              <h3 className="mb-4 pb-3 border-b border-gray-100">{t('showOnMap')}</h3>
              <div className="flex flex-col gap-3">
                {categories.map((category) => {
                  const Icon = category.icon;
                  const isChecked = selectedCategories[category.key];
                  
                  return (
                    <label 
                      key={category.key}
                      className="flex items-center gap-3 cursor-pointer group"
                    >
                      <div className="relative flex items-center">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleCategory(category.key)}
                          className="w-5 h-5 rounded border-2 border-gray-300 cursor-pointer appearance-none checked:bg-blue-500 checked:border-blue-500 transition-all"
                          style={{
                            accentColor: category.color
                          }}
                        />
                        {isChecked && (
                          <svg
                            className="absolute left-0.5 top-0.5 w-4 h-4 pointer-events-none"
                            fill="white"
                            viewBox="0 0 16 16"
                          >
                            <path d="M13.5 3L6 10.5L2.5 7" stroke="white" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-2 flex-1">
                        <div 
                          className="w-8 h-8 rounded-lg flex items-center justify-center"
                          style={{ 
                            backgroundColor: `${category.color}15`,
                            color: category.color
                          }}
                        >
                          <Icon className="w-4 h-4" />
                        </div>
                        <span className="text-[14px] group-hover:text-blue-600 transition-colors" style={{ color: 'var(--text-primary)' }}>
                          {t(category.labelKey as any)}
                        </span>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* QUICK STATS */}
            <div className="mt-6 pt-6 border-t border-gray-100">
              <h4 className="text-[13px] mb-3" style={{ color: 'var(--text-muted)' }}>{t('visibleLocations')}</h4>
              <div className="grid grid-cols-2 gap-2">
                {categories.map((category) => {
                  if (!selectedCategories[category.key]) return null;
                  
                  const counts: Record<string, number> = {
                    'food-and-drink': 47,
                    attractions: 31,
                    hotels: 18,
                    apartments: 25,
                    cafes: 15,
                    clubs: 23
                  };
                  
                  return (
                    <div 
                      key={category.key}
                      className="px-3 py-2 rounded-lg text-center"
                      style={{ 
                        backgroundColor: `${category.color}10`,
                        border: `1px solid ${category.color}30`
                      }}
                    >
                      <div className="text-[18px]" style={{ color: category.color }}>
                        {counts[category.key]}
                      </div>
                      <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                        {t(category.labelKey as any)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

          </aside>

        </div>
      </div>
    </div>
  );
}