import { useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../contexts/AuthContext';

export default function LoginPage() {
  const navigate = useNavigate();
  const { openAuthModal, isLoggedIn } = useAuth();

  useEffect(() => {
    // If already logged in, redirect to home
    if (isLoggedIn) {
      navigate('/');
      return;
    }

    // Open auth modal with login tab
    openAuthModal('login');
    
    // Redirect to home page (modal will remain open)
    navigate('/');
  }, [navigate, openAuthModal, isLoggedIn]);

  return null;
}
