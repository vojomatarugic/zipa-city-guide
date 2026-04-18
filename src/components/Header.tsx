import { Search, Menu, X, MapPin, ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { Link, useLocation as useRouterLocation } from 'react-router';
import { useT } from '../hooks/useT';
import { useLocation } from '../contexts/LocationContext';
import { useAuth } from '../contexts/AuthContext';
import { headerProfileButtonLabel } from '../utils/userDisplay';
import { LanguageSwitcher } from './LanguageSwitcher';
import { GRADIENTS, BORDERS, SHADOWS } from '../utils/colors';
import zipaLogo from '../assets/9265992fac3001b28e85179123b7b79ce1f668b0.png';

export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [loginHover, setLoginHover] = useState(false);
  const { t } = useT();
  const routerLocation = useRouterLocation();
  const { selectedCity, setIsCityPopupOpen } = useLocation();
  const { isLoggedIn, isAdmin, user, openAuthModal } = useAuth();
  
  // Get current page from URL path
  const currentPage = routerLocation.pathname === '/' ? 'home' : routerLocation.pathname.slice(1);

  // Navigation gradients matching the cards
  const navGradients = GRADIENTS;

  const navItems = [
    { key: 'home', path: '/', label: t('home'), isActive: currentPage === 'home', gradient: navGradients.home },
    { key: 'events', path: '/events', label: t('events'), isActive: currentPage === 'events', gradient: navGradients.events },
    { key: 'theatre', path: '/theatre', label: t('theatre'), isActive: currentPage === 'theatre', gradient: navGradients.theatre },
    { key: 'cinema', path: '/cinema', label: t('cinema'), isActive: currentPage === 'cinema', gradient: navGradients.cinema },
    { key: 'concerts', path: '/concerts', label: t('concerts'), isActive: currentPage === 'concerts', gradient: navGradients.concerts },
    { key: 'clubs', path: '/clubs', label: t('clubs'), isActive: currentPage === 'clubs', gradient: navGradients.clubs },
    { key: 'foodAndDrink', path: '/food-and-drink', label: t('foodAndDrink'), isActive: currentPage === 'food-and-drink' || currentPage.startsWith('food-and-drink'), gradient: navGradients.foodAndDrink },
  ];

  return (
    <header 
      className="bg-white sticky top-0 z-50"
      style={{ 
        height: '72px',
        borderBottom: `1px solid ${BORDERS.light}`,
        boxShadow: SHADOWS.card
      }}
    >
      {/* Content Wrapper */}
      <div 
        className="h-full mx-auto flex items-center justify-between"
        style={{
          maxWidth: '1280px',
          paddingLeft: '20px',
          paddingRight: '20px'
        }}
      >
        {/* Logo Area */}
        <div className="flex items-center" style={{ gap: '12px' }}>
          {/* ZIPA Agency Logo - External Link */}
          <a 
            href="https://www.zipaagency.com/" 
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center no-underline"
          >
            <img 
              src={zipaLogo} 
              alt="ZIPA Agency" 
              style={{ 
                height: '32px',
                width: 'auto',
                transition: 'opacity 0.2s'
              }}
              className="hover:opacity-80"
            />
          </a>
          
          {/* Separator */}
          <div style={{
            width: '1px',
            height: '32px',
            background: '#E5E9F0'
          }} />
          
          {/* Zipa City Guide Logo - Internal Link */}
          <Link 
            to="/" 
            className="flex items-center no-underline"
            style={{ gap: '8px' }}
          >
            <div style={{
              fontSize: '20px',
              fontWeight: 700,
              color: '#0E3DC5',
              letterSpacing: '-0.5px'
            }}>
              {t('appName')}
            </div>
          </Link>

          {/* Location Dropdown */}
          <div
            className="flex items-center gap-2 px-3 py-1.5 rounded-md cursor-pointer transition-all hover:bg-gray-50"
            style={{
              borderLeft: '1px solid #E5E9F0',
              paddingLeft: '12px',
              marginLeft: '8px'
            }}
            onClick={() => setIsCityPopupOpen(true)}
          >
            <MapPin size={16} style={{ color: '#0E3DC5' }} />
            <span
              style={{
                fontSize: '14px',
                fontWeight: 500,
                color: '#1a1a1a',
              }}
            >
              {selectedCity}
            </span>
            <ChevronDown
              size={14}
              style={{ color: '#6B7280' }}
            />
          </div>
        </div>

        {/* Desktop Navigation */}
        <nav 
          className="hidden lg:flex items-center" 
          style={{ 
            gap: '24px',
            alignSelf: 'flex-end',
            paddingBottom: '12px'
          }}
        >
          {navItems.map((item) => (
            <Link 
              key={item.key}
              to={item.path}
              className="flex flex-col items-center no-underline transition-all hover:opacity-80"
              style={{ gap: '4px', padding: 0, position: 'relative' }}
              onClick={() => setMobileMenuOpen(false)}
            >
              <span style={{
                fontSize: '16px',
                fontWeight: 500,
                background: item.gradient,
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text'
              }}>
                {item.label}
              </span>
              <span 
                style={{ 
                  height: '3px',
                  width: '100%',
                  background: item.isActive ? item.gradient : 'transparent',
                  borderRadius: '999px',
                  transition: 'background 0.2s'
                }}
              />
            </Link>
          ))}
        </nav>

        {/* Desktop Actions */}
        <div className="hidden lg:flex items-center" style={{ gap: '12px' }}>
          {/* Language Switcher */}
          <LanguageSwitcher currentPage={currentPage} />

          {/* Auth CTA Button */}
          {!isLoggedIn ? (
            <button
              onClick={() => openAuthModal('login')}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'linear-gradient(135deg, #0E3DC5 0%, #1E50E6 100%)';
                e.currentTarget.style.transform = 'translateY(-1px)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(14, 61, 197, 0.35)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'linear-gradient(135deg, #60A5FA 0%, #0E3DC5 100%)';
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 2px 8px rgba(14, 61, 197, 0.25)';
              }}
              className="border-0 cursor-pointer"
              style={{
                background: 'linear-gradient(135deg, #60A5FA 0%, #0E3DC5 100%)',
                color: '#FFFFFF',
                fontSize: '13px',
                fontWeight: 600,
                padding: '8px 20px',
                borderRadius: '10px',
                boxShadow: '0 2px 8px rgba(14, 61, 197, 0.25)',
                transition: 'all 0.2s ease',
                whiteSpace: 'nowrap',
              }}
            >
              {t('login')}
            </button>
          ) : (
            <Link
              to={isAdmin ? "/admin" : "/my-panel"}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'linear-gradient(135deg, #0E3DC5 0%, #1E50E6 100%)';
                e.currentTarget.style.transform = 'translateY(-1px)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(14, 61, 197, 0.35)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'linear-gradient(135deg, #60A5FA 0%, #0E3DC5 100%)';
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 2px 8px rgba(14, 61, 197, 0.25)';
              }}
              className="border-0 cursor-pointer"
              style={{
                background: 'linear-gradient(135deg, #60A5FA 0%, #0E3DC5 100%)',
                color: '#FFFFFF',
                fontSize: '13px',
                fontWeight: 600,
                padding: '8px 20px',
                borderRadius: '10px',
                boxShadow: '0 2px 8px rgba(14, 61, 197, 0.25)',
                transition: 'all 0.2s ease',
                whiteSpace: 'nowrap',
              }}
            >
              {user ? headerProfileButtonLabel(user) : t('myPanel')}
            </Link>
          )}
        </div>

        {/* Mobile Actions - Language Switcher + Menu Button */}
        <div className="flex md:hidden items-center" style={{ gap: '12px' }}>
          {/* Language Switcher */}
          <LanguageSwitcher currentPage={currentPage} />

          {/* Mobile Auth CTA (compact) */}
          {!isLoggedIn && (
            <button
              onClick={() => openAuthModal('login')}
              className="border-0 cursor-pointer"
              style={{
                background: 'linear-gradient(135deg, #60A5FA 0%, #0E3DC5 100%)',
                color: '#FFFFFF',
                fontSize: '12px',
                fontWeight: 600,
                padding: '7px 14px',
                borderRadius: '8px',
                boxShadow: '0 2px 6px rgba(14, 61, 197, 0.2)',
                whiteSpace: 'nowrap',
              }}
            >
              {t('login')}
            </button>
          )}

          {/* Mobile Menu Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="flex items-center justify-center w-10 h-10 rounded-lg border"
            style={{ 
              background: 'transparent',
              borderColor: '#d0d0d0'
            }}
            aria-label={t('toggleMenu')}
          >
            {mobileMenuOpen ? (
              <X className="w-5 h-5" style={{ color: '#1a1a1a' }} />
            ) : (
              <Menu className="w-5 h-5" style={{ color: '#1a1a1a' }} />
            )}
          </button>
        </div>
      </div>

      {/* Mobile Menu Overlay - Full Screen */}
      {mobileMenuOpen && (
        <div 
          className="lg:hidden fixed left-0 right-0 bg-white z-50"
          style={{
            top: '72px',
            borderRadius: '16px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.08)'
          }}
        >
          <div className="flex flex-col">
            {/* Mobile Navigation Links */}
            <nav className="flex flex-col px-5">
              {navItems.map((item) => (
                <Link 
                  key={item.key}
                  to={item.path}
                  onClick={() => setMobileMenuOpen(false)}
                  className="no-underline transition-colors py-4 border-b"
                  style={{ 
                    borderColor: '#E5E9F0',
                    fontSize: '18px',
                    fontWeight: 500,
                    color: '#1a1a1a'
                  }}
                >
                  {item.label}
                </Link>
              ))}
            </nav>

            {/* Mobile Actions */}
            <div className="px-5 py-4" style={{ borderColor: '#E5E9F0' }}>
              {/* Search Bar */}
              <div className="relative">
                <input
                  type="text"
                  placeholder={t('search')}
                  className="w-full px-4 py-3 rounded-lg border"
                  style={{
                    background: 'white',
                    borderColor: '#E5E9F0',
                    fontSize: '16px',
                    fontWeight: 500,
                    color: '#5A6C7D'
                  }}
                />
                <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
              </div>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}