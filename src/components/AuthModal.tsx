import { useEffect, useState } from "react";
import { Link } from "react-router";
import { Mail, X } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { useT } from "../hooks/useT";
const zipaLogo = "/zipa-logo.png";

function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}

function LoadingSpinner() {
  return (
    <div
      className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-gray-600"
      aria-hidden="true"
    />
  );
}

export function AuthModal() {
  const {
    showAuthModal,
    closeAuthModal,
    signInOrSignUp,
    resetPassword,
    socialLogin,
  } = useAuth();
  const { t } = useT();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isEmailLoading, setIsEmailLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [showEmailForm, setShowEmailForm] = useState(false);

  useEffect(() => {
    if (!showAuthModal) {
      setEmail("");
      setPassword("");
      setError("");
      setSuccessMessage("");
      setShowEmailForm(false);
      setIsEmailLoading(false);
      setIsGoogleLoading(false);
    }
  }, [showAuthModal]);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && showAuthModal) {
        closeAuthModal();
      }
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [closeAuthModal, showAuthModal]);

  useEffect(() => {
    document.body.style.overflow = showAuthModal ? "hidden" : "unset";
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [showAuthModal]);

  const isAnyLoading = isEmailLoading || isGoogleLoading;

  const handleGoogleLogin = async () => {
    if (isAnyLoading) return;
    setError("");
    setSuccessMessage("");
    setIsGoogleLoading(true);
    try {
      await socialLogin("google");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("authModalGenericError"));
      setIsGoogleLoading(false);
    }
  };

  const handleEmailSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (isAnyLoading) return;
    setError("");
    setSuccessMessage("");

    if (!email || !email.includes("@")) {
      setError(t("authModalInvalidEmail"));
      return;
    }
    if (!password || password.length < 6) {
      setError(t("passwordTooShort"));
      return;
    }

    setIsEmailLoading(true);
    try {
      await signInOrSignUp(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("authModalGenericError"));
    } finally {
      setIsEmailLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (isAnyLoading) return;
    if (!email || !email.includes("@")) {
      setError(t("authModalResetEmailRequired"));
      return;
    }
    setError("");
    setSuccessMessage("");
    setIsEmailLoading(true);
    try {
      await resetPassword(email);
      setSuccessMessage(t("authModalResetPasswordSent"));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("authModalGenericError"));
    } finally {
      setIsEmailLoading(false);
    }
  };

  if (!showAuthModal) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4"
      onClick={closeAuthModal}
      role="presentation"
    >
      <div
        className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl sm:p-8"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-modal-title"
      >
        <button
          type="button"
          onClick={closeAuthModal}
          className="absolute right-4 top-4 rounded-full p-1.5 text-gray-500 transition hover:bg-gray-100 hover:text-gray-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
          aria-label={t("close")}
        >
          <X size={20} />
        </button>

        <div className="mb-4 flex justify-center">
          <img
            src={zipaLogo}
            alt="ZIPA Agency"
            className="h-8 w-auto object-contain sm:h-10"
          />
        </div>

        <h2
          id="auth-modal-title"
          className="text-center text-2xl font-bold text-gray-900"
        >
          {t("authModalTitle")}
        </h2>
        <p className="mt-1 text-center text-sm text-gray-500">
          {t("authModalSubtitle")}
        </p>

        {!showEmailForm ? (
          <div className="mt-6">
            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={isAnyLoading}
              className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl border border-gray-300 bg-white hover:shadow-md transition disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
            >
              {isGoogleLoading ? <LoadingSpinner /> : <GoogleIcon />}
              <span>
                {isGoogleLoading
                  ? t("authModalConnecting")
                  : t("authModalContinueWithGoogle")}
              </span>
            </button>

            <div className="my-4 flex items-center gap-4">
              <div className="h-px flex-1 bg-gray-200" />
              <span className="text-xs text-gray-400">
                {t("authModalDividerOr")}
              </span>
              <div className="h-px flex-1 bg-gray-200" />
            </div>

            <button
              type="button"
              onClick={() => {
                setError("");
                setSuccessMessage("");
                setShowEmailForm(true);
              }}
              disabled={isAnyLoading}
              className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 hover:bg-gray-100 transition disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
            >
              <Mail size={20} className="text-gray-600" aria-hidden="true" />
              <span>{t("authModalContinueWithEmail")}</span>
            </button>
          </div>
        ) : (
          <div className="mt-6">
            <button
              type="button"
              onClick={() => {
                setError("");
                setSuccessMessage("");
                setShowEmailForm(false);
              }}
              className="mb-4 text-sm font-medium text-blue-700 hover:text-blue-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
            >
              {t("back")}
            </button>

            <form onSubmit={handleEmailSubmit} className="flex flex-col gap-3">
              <div>
                <label
                  htmlFor="auth-email"
                  className="mb-1 block text-sm font-medium text-gray-700"
                >
                  {t("email")}
                </label>
                <input
                  id="auth-email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                  placeholder={t("enterEmail")}
                  className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm text-gray-900 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
                />
              </div>

              <div>
                <label
                  htmlFor="auth-password"
                  className="mb-1 block text-sm font-medium text-gray-700"
                >
                  {t("password")}
                </label>
                <input
                  id="auth-password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  placeholder={t("enterPassword")}
                  className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm text-gray-900 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
                />
              </div>

              {error && (
                <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                  {error}
                </div>
              )}
              {successMessage && (
                <div className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                  {successMessage}
                </div>
              )}

              <button
                type="submit"
                disabled={isAnyLoading}
                className="mt-1 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
              >
                {isEmailLoading && <LoadingSpinner />}
                <span>{isEmailLoading ? t("formLoading") : t("continue")}</span>
              </button>
            </form>

            <div className="mt-3 text-center">
              <button
                type="button"
                onClick={handleForgotPassword}
                disabled={isAnyLoading}
                className="text-sm text-blue-700 transition hover:text-blue-800 hover:underline disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
              >
                {t("forgotPassword")}
              </button>
            </div>
          </div>
        )}

        {!showEmailForm && error && (
          <div className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        <p className="mt-6 text-center text-xs leading-relaxed text-gray-500">
          {t("authModalLegalPrefix")}{" "}
          <Link
            to="/politika-privatnosti"
            className="font-medium text-blue-700 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
          >
            {t("authModalPrivacyPolicy")}
          </Link>{" "}
          {t("authModalLegalAnd")}{" "}
          <Link
            to="/uslovi-koristenja"
            className="font-medium text-blue-700 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
          >
            {t("authModalTermsOfUse")}
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
