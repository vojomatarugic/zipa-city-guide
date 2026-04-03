import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router';
import { AuthModal } from './AuthModal';
import { CityModal } from './CityModal';
import { useAuth } from '../contexts/AuthContext';

export function RootLayout() {
  const { isLoading } = useAuth();
  const location = useLocation();
  const [forceShow, setForceShow] = useState(false);

  // Scroll to top on route change
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [location.pathname, location.search]);

  // ✅ Safety timeout: force render after 3s even if auth is still loading
  useEffect(() => {
    const timer = setTimeout(() => {
      if (isLoading) {
        console.warn('⚠️ [RootLayout] Auth loading timeout - forcing render');
        setForceShow(true);
      }
    }, 3000);
    return () => clearTimeout(timer);
  }, [isLoading]);

  // Show loading spinner while auth initializes (with timeout fallback)
  if (isLoading && !forceShow) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-white">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-[#0E3DC5] border-t-transparent"></div>
      </div>
    );
  }

  return (
    <>
      <Outlet />
      <CityModal />
      <AuthModal />
    </>
  );
}