import { useEffect } from 'react';
import { useLocation } from 'react-router';

export function ScrollRestoration() {
  const location = useLocation();

  useEffect(() => {
    // UVIJEK SCROLL NA VRH - BEZ IZUZETAKA
    window.scrollTo(0, 0);
  }, [location.pathname]);

  return null;
}
