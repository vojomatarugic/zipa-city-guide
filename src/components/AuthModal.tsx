import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useT } from '../hooks/useT';
import { useLanguage } from '../contexts/LanguageContext';
import { BRAND, TEXT, BORDERS } from '../utils/colors';
import { X, Mail } from 'lucide-react';
import { getLastLoginInfo, clearLastLoginInfo, type LastLoginInfo, type LoginMethod } from '../utils/authService';

const AUTH_IMAGE = "https://images.unsplash.com/photo-1758272133719-959319bc2364?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxoYXBweSUyMGZyaWVuZHMlMjBzZWxmaWUlMjBwYXJ0eSUyMGNlbGVicmF0aW9ufGVufDF8fHx8MTc3Mjk2NDQ3Nnww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral";

// SVG icons for social providers
function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}

function FacebookIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="#1877F2">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="#000000">
      <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
    </svg>
  );
}

const PROVIDER_LABELS: Record<LoginMethod, { sr: string; en: string }> = {
  google: { sr: 'Google', en: 'Google' },
  facebook: { sr: 'Facebook', en: 'Facebook' },
  apple: { sr: 'Apple', en: 'Apple' },
  email: { sr: 'Email', en: 'Email' },
};

const PROVIDER_ICONS: Record<LoginMethod, React.ReactNode> = {
  google: <GoogleIcon />,
  facebook: <FacebookIcon />,
  apple: <AppleIcon />,
  email: <Mail size={20} style={{ color: '#6B7280' }} />,
};

export function AuthModal() {
  const { showAuthModal, closeAuthModal, signInOrSignUp, resetPassword, socialLogin } = useAuth();
  const { t } = useT();
  const { language } = useLanguage();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [continueHover, setContinueHover] = useState(false);
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [lastLogin, setLastLogin] = useState<LastLoginInfo | null>(null);
  const [hoveredSocial, setHoveredSocial] = useState<string | null>(null);

  // Load last login info
  useEffect(() => {
    if (showAuthModal) {
      const info = getLastLoginInfo();
      setLastLogin(info);
      // Always pre-fill remembered email when modal opens
      if (info?.email) {
        setEmail(info.email);
      }
    }
  }, [showAuthModal]);

  // Reset form when modal opens/closes
  useEffect(() => {
    if (!showAuthModal) {
      setEmail('');
      setPassword('');
      setError('');
      setSuccessMessage('');
      setShowEmailForm(false);
      setShowForgotPassword(false);
      setSocialLoading(null);
    }
  }, [showAuthModal]);

  // ESC key to close modal
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && showAuthModal) {
        closeAuthModal();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [showAuthModal, closeAuthModal]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (showAuthModal) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => { document.body.style.overflow = 'unset'; };
  }, [showAuthModal]);

  const handleSocialLogin = async (provider: 'google' | 'facebook' | 'apple') => {
    setSocialLoading(provider);
    setError('');
    try {
      await socialLogin(provider);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Došlo je do greške');
      setSocialLoading(null);
    }
  };

  if (!showAuthModal) return null;

  const hasLastLogin = lastLogin !== null;

  // Social button component
  const SocialButton = ({ provider, label }: { provider: LoginMethod; label: string }) => {
    const isHovered = hoveredSocial === provider;
    const isThisLoading = socialLoading === provider;
    
    return (
      <button
        onClick={() => {
          if (provider === 'email') {
            setShowEmailForm(true);
          } else {
            handleSocialLogin(provider as 'google' | 'facebook' | 'apple');
          }
        }}
        disabled={!!socialLoading}
        className="w-full flex items-center justify-center gap-3 py-3 rounded-lg transition-all"
        style={{
          border: `1px solid ${isHovered ? '#D1D5DB' : BORDERS.medium}`,
          background: isHovered ? '#F9FAFB' : '#FFFFFF',
          cursor: socialLoading ? 'not-allowed' : 'pointer',
          opacity: socialLoading && !isThisLoading ? 0.5 : 1,
          fontSize: '14px',
          fontWeight: 500,
          color: '#374151',
          transition: 'all 0.2s ease',
        }}
        onMouseEnter={() => setHoveredSocial(provider)}
        onMouseLeave={() => setHoveredSocial(null)}
      >
        {isThisLoading ? (
          <div style={{
            width: '20px',
            height: '20px',
            border: '2px solid #E5E7EB',
            borderTopColor: BRAND.primary,
            borderRadius: '50%',
            animation: 'authSpin 0.6s linear infinite',
          }} />
        ) : (
          PROVIDER_ICONS[provider]
        )}
        <span>{isThisLoading ? (language === 'sr' ? 'Povezivanje...' : 'Connecting...') : label}</span>
      </button>
    );
  };

  // Divider with "or"
  const Divider = () => (
    <div className="flex items-center gap-3" style={{ margin: '16px 0' }}>
      <div className="flex-1" style={{ height: '1px', background: '#E5E7EB' }} />
      <span style={{ fontSize: '13px', color: '#9CA3AF', fontWeight: 500 }}>
        {language === 'sr' ? 'ili' : 'or'}
      </span>
      <div className="flex-1" style={{ height: '1px', background: '#E5E7EB' }} />
    </div>
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!email || !email.includes('@')) {
      setError(language === 'sr' ? 'Unesi validnu email adresu' : 'Enter a valid email address');
      return;
    }
    if (!password || password.length < 6) {
      setError(language === 'sr' ? 'Lozinka mora imati najmanje 6 karaktera' : 'Password must be at least 6 characters');
      return;
    }
    
    setIsLoading(true);
    try {
      await signInOrSignUp(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Došlo je do greške');
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email || !email.includes('@')) {
      setError(language === 'sr' ? 'Unesi email adresu za reset lozinke' : 'Enter your email address for password reset');
      return;
    }
    setError('');
    setIsLoading(true);
    try {
      await resetPassword(email);
      setSuccessMessage(
        language === 'sr'
          ? 'Link za reset lozinke je poslan na navedeni email'
          : 'Password reset link has been sent to the provided email'
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Došlo je do greške');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 flex items-start justify-center z-50"
      onClick={closeAuthModal}
      style={{
        padding: '20px',
        paddingTop: '80px',
        background: 'rgba(0, 0, 0, 0.65)',
        animation: 'authFadeIn 0.2s ease-out',
      }}
    >
      {/* Modal Container — 50% bigger than CityModal */}
      <div
        className="rounded-xl shadow-2xl w-full overflow-hidden relative flex"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: '1008px',
          maxHeight: '90vh',
          background: '#FFFFFF',
          animation: 'authSlideDown 0.5s ease-out',
        }}
      >
        {/* LEFT SIDE — Image */}
        <div
          className="hidden md:block relative"
          style={{
            width: '42%',
            minHeight: '560px',
            flexShrink: 0,
          }}
        >
          <img
            src={AUTH_IMAGE}
            alt=""
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              display: 'block',
            }}
          />
          {/* Overlay gradient at bottom */}
          <div style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: '120px',
            background: 'linear-gradient(to top, rgba(0,0,0,0.45), transparent)',
          }} />
          <div style={{
            position: 'absolute',
            bottom: '24px',
            left: '24px',
            right: '24px',
          }}>
            <p style={{
              color: '#FFFFFF',
              fontSize: '16px',
              fontWeight: 600,
              lineHeight: 1.4,
              textShadow: '0 1px 3px rgba(0,0,0,0.3)',
              margin: 0,
            }}>
              {language === 'sr'
                ? 'Otkrij najbolje događaje u svom gradu'
                : 'Discover the best events in your city'}
            </p>
          </div>
        </div>

        {/* RIGHT SIDE — Form */}
        <div
          className="flex-1 relative"
          style={{
            padding: '36px 32px',
            overflowY: 'auto',
          }}
        >
          {/* Close Button */}
          <button
            onClick={closeAuthModal}
            className="absolute top-4 right-4 p-1.5 rounded-full transition-colors"
            style={{
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = '#F3F4F6'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
          >
            <X size={20} style={{ color: '#6B7280' }} />
          </button>

          {/* Title */}
          <h2
            className="text-center"
            style={{
              fontSize: '22px',
              fontWeight: 700,
              color: '#1a1a1a',
              marginBottom: '6px',
              lineHeight: 1.3,
            }}
          >
            {showEmailForm
              ? (language === 'sr' ? 'Prijavi se' : 'Sign In')
              : (hasLastLogin
                  ? (language === 'sr' ? 'Dobro došao nazad!' : 'Welcome back!')
                  : (language === 'sr' ? 'Prijavi se' : 'Sign In'))
            }
          </h2>
          <p
            className="text-center"
            style={{
              fontSize: '14px',
              color: '#6B7280',
              marginBottom: '24px',
            }}
          >
            {showEmailForm
              ? (language === 'sr' ? 'Unesi email i lozinku za prijavu ili kreiranje naloga' : 'Enter your email and password to sign in or create an account')
              : (hasLastLogin
                  ? (language === 'sr'
                    ? `Prijavi se ponovo sa ${PROVIDER_LABELS[lastLogin!.method][language]} ili odaberi drugi način`
                    : `Sign in again with ${PROVIDER_LABELS[lastLogin!.method][language]} or choose another method`)
                  : (language === 'sr' ? 'Odaberi način prijave' : 'Choose your sign in method'))
            }
          </p>

          {/* ===== SOCIAL SELECTION — Welcome back with last method highlighted ===== */}
          {!showEmailForm && hasLastLogin && (
            <div className="flex flex-col gap-3">
              {/* Highlighted last-used method */}
              <div style={{
                border: `2px solid ${BRAND.primary}`,
                borderRadius: '12px',
                padding: '2px',
                position: 'relative',
              }}>
                <div style={{
                  position: 'absolute',
                  top: '-10px',
                  left: '16px',
                  background: '#FFFFFF',
                  padding: '0 8px',
                  fontSize: '11px',
                  fontWeight: 600,
                  color: BRAND.primary,
                }}>
                  {language === 'sr' ? 'Posljednji put korišteno' : 'Last used'}
                </div>
                {lastLogin!.method === 'email' ? (
                  <button
                    onClick={() => {
                      // Pre-fill remembered email
                      if (lastLogin!.email) {
                        setEmail(lastLogin!.email);
                      }
                      setShowEmailForm(true);
                    }}
                    className="w-full flex items-center justify-center gap-3 py-3 rounded-lg"
                    style={{
                      border: 'none',
                      background: 'transparent',
                      cursor: 'pointer',
                      fontSize: '14px',
                      fontWeight: 500,
                      color: '#374151',
                    }}
                  >
                    <Mail size={20} style={{ color: '#6B7280' }} />
                    <span>
                      {language === 'sr' ? 'Nastavi sa Email' : 'Continue with Email'}
                      {lastLogin!.email && (
                        <span style={{ color: '#9CA3AF', marginLeft: '6px', fontSize: '13px' }}>
                          ({lastLogin!.email})
                        </span>
                      )}
                    </span>
                  </button>
                ) : (
                  <SocialButton
                    provider={lastLogin!.method}
                    label={`${language === 'sr' ? 'Nastavi sa' : 'Continue with'} ${PROVIDER_LABELS[lastLogin!.method][language]}`}
                  />
                )}
              </div>

              {/* Second option: use a different account (same visual weight as last-used) */}
              <div style={{
                border: `2px solid ${BRAND.primary}`,
                borderRadius: '12px',
                padding: '2px',
                position: 'relative',
              }}>
                <button
                  type="button"
                  onClick={() => {
                    clearLastLoginInfo();
                    setLastLogin(null);
                    setEmail('');
                    setPassword('');
                  }}
                  className="w-full flex items-center justify-center gap-3 py-3 rounded-lg"
                  style={{
                    border: 'none',
                    background: 'transparent',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: 600,
                    color: '#374151',
                  }}
                >
                  <span>
                    {language === 'sr' ? 'Koristi drugi nalog' : 'Use a different account'}
                  </span>
                </button>
              </div>

              <Divider />

              {/* Other methods */}
              {lastLogin!.method !== 'google' && (
                <SocialButton
                  provider="google"
                  label={`${language === 'sr' ? 'Nastavi sa' : 'Continue with'} Google`}
                />
              )}
              {lastLogin!.method !== 'facebook' && (
                <SocialButton
                  provider="facebook"
                  label={`${language === 'sr' ? 'Nastavi sa' : 'Continue with'} Facebook`}
                />
              )}
              {lastLogin!.method !== 'apple' && (
                <SocialButton
                  provider="apple"
                  label={`${language === 'sr' ? 'Nastavi sa' : 'Continue with'} Apple`}
                />
              )}
              {lastLogin!.method !== 'email' && (
                <SocialButton
                  provider="email"
                  label={language === 'sr' ? 'Nastavi sa Email' : 'Continue with Email'}
                />
              )}
            </div>
          )}

          {/* ===== SOCIAL SELECTION — First time (no remembered method) ===== */}
          {!showEmailForm && !hasLastLogin && (
            <div className="flex flex-col gap-3">
              <SocialButton
                provider="google"
                label={`${language === 'sr' ? 'Nastavi sa' : 'Continue with'} Google`}
              />
              <SocialButton
                provider="facebook"
                label={`${language === 'sr' ? 'Nastavi sa' : 'Continue with'} Facebook`}
              />
              <SocialButton
                provider="apple"
                label={`${language === 'sr' ? 'Nastavi sa' : 'Continue with'} Apple`}
              />

              <Divider />

              <SocialButton
                provider="email"
                label={language === 'sr' ? 'Nastavi sa Email' : 'Continue with Email'}
              />
            </div>
          )}

          {/* ===== EMAIL FORM (shown when user clicks "Continue with Email") ===== */}
          {showEmailForm && (
            <>
              {/* Back arrow */}
              <button
                onClick={() => { setShowEmailForm(false); setError(''); setSuccessMessage(''); }}
                style={{
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  padding: '4px',
                  position: 'absolute',
                  top: '40px',
                  left: '32px',
                }}
                onMouseEnter={(e) => e.currentTarget.style.opacity = '0.6'}
                onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 12H5"/>
                  <path d="m12 19-7-7 7-7"/>
                </svg>
              </button>

              <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
                {/* Email */}
                <div>
                  <label htmlFor="auth-email" className="block mb-1.5"
                    style={{ fontSize: '13px', fontWeight: 600, color: TEXT.primary }}
                  >
                    Email
                  </label>
                  <input
                    id="auth-email" type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full px-3.5 py-2.5 rounded-lg"
                    style={{ fontSize: '14px', border: `1px solid ${BORDERS.medium}`, outline: 'none', transition: 'border-color 0.2s' }}
                    onFocus={(e) => e.currentTarget.style.borderColor = BRAND.primary}
                    onBlur={(e) => e.currentTarget.style.borderColor = BORDERS.medium}
                    placeholder={language === 'sr' ? 'Unesi email ovdje' : 'Enter your email here'}
                  />
                </div>

                {/* Password */}
                <div>
                  <label htmlFor="auth-password" className="block mb-1.5"
                    style={{ fontSize: '13px', fontWeight: 600, color: TEXT.primary }}
                  >
                    {language === 'sr' ? 'Lozinka' : 'Password'}
                  </label>
                  <input
                    id="auth-password" type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="w-full px-3.5 py-2.5 rounded-lg"
                    style={{ fontSize: '14px', border: `1px solid ${BORDERS.medium}`, outline: 'none', transition: 'border-color 0.2s' }}
                    onFocus={(e) => e.currentTarget.style.borderColor = BRAND.primary}
                    onBlur={(e) => e.currentTarget.style.borderColor = BORDERS.medium}
                    placeholder={language === 'sr' ? 'Unesi lozinku' : 'Enter your password'}
                  />
                </div>

                {/* Remember Me Checkbox */}
                <div className="flex items-center">
                  <input
                    id="auth-remember"
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="mr-2"
                    style={{ width: '16px', height: '16px' }}
                  />
                  <label htmlFor="auth-remember" style={{ fontSize: '13px', color: '#6B7280' }}>
                    {language === 'sr' ? 'Zapamti me' : 'Remember me'}
                  </label>
                </div>

                {/* Error Message */}
                {error && (
                  <div className="p-2.5 rounded-lg"
                    style={{ background: '#FEE2E2', color: '#991B1B', fontSize: '13px' }}
                  >
                    {error}
                  </div>
                )}

                {/* Success Message */}
                {successMessage && (
                  <div className="p-2.5 rounded-lg"
                    style={{ background: '#D1FAE5', color: '#16A34A', fontSize: '13px' }}
                  >
                    {successMessage}
                  </div>
                )}

                {/* Submit Button */}
                <button
                  type="submit" disabled={isLoading}
                  className="w-full py-3 rounded-lg font-semibold"
                  style={{
                    background: continueHover
                      ? 'linear-gradient(135deg, #0E3DC5 0%, #1E50E6 100%)'
                      : 'linear-gradient(135deg, #60A5FA 0%, #0E3DC5 100%)',
                    color: '#FFFFFF',
                    fontSize: '15px',
                    fontWeight: 600,
                    border: 'none',
                    cursor: isLoading ? 'not-allowed' : 'pointer',
                    opacity: isLoading ? 0.6 : 1,
                    transition: 'all 0.2s ease',
                    boxShadow: continueHover
                      ? '0 4px 12px rgba(14, 61, 197, 0.35)'
                      : '0 2px 8px rgba(14, 61, 197, 0.2)',
                    marginTop: '4px',
                  }}
                  onMouseEnter={() => setContinueHover(true)}
                  onMouseLeave={() => setContinueHover(false)}
                >
                  {isLoading
                    ? t('formLoading')
                    : (language === 'sr' ? 'Nastavi' : 'Continue')
                  }
                </button>
              </form>

              {/* Forgot Password Link */}
              <div className="text-center mt-3">
                <button
                  onClick={handleForgotPassword}
                  disabled={isLoading}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    cursor: isLoading ? 'not-allowed' : 'pointer',
                    fontSize: '13px',
                    color: BRAND.primary,
                    textDecoration: 'none',
                    padding: '4px 0',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.textDecoration = 'underline'}
                  onMouseLeave={(e) => e.currentTarget.style.textDecoration = 'none'}
                >
                  {language === 'sr' ? 'Zaboravljena lozinka?' : 'Forgot your password?'}
                </button>
              </div>
            </>
          )}

          {/* Error for social logins (shown outside email form) */}
          {!showEmailForm && error && (
            <div className="p-2.5 rounded-lg mt-3"
              style={{ background: '#FEE2E2', color: '#991B1B', fontSize: '13px' }}
            >
              {error}
            </div>
          )}

          {/* Privacy Policy text */}
          <p
            className="text-center"
            style={{
              fontSize: '12px',
              color: '#9CA3AF',
              marginTop: '20px',
              lineHeight: 1.5,
            }}
          >
            {language === 'sr'
              ? 'Prijavom prihvataš '
              : 'By Signing In, I agree to '}
            <span style={{ color: BRAND.primary, cursor: 'pointer' }}>
              {language === 'sr' ? 'Politiku privatnosti' : 'Privacy Policy'}
            </span>
            {language === 'sr' ? ' i ' : ' and '}
            <span style={{ color: BRAND.primary, cursor: 'pointer' }}>
              {language === 'sr' ? 'Uslove korištenja' : 'Terms of Service'}
            </span>.
          </p>
        </div>
      </div>

      <style>{`
        @keyframes authFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes authSlideDown {
          from { transform: translateY(-100vh); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        @keyframes authSpin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}