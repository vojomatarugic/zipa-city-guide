import { useState } from 'react';
import emailjs from '@emailjs/browser';
import { MapPin, Phone, Mail } from 'lucide-react';
import { useT } from '../hooks/useT';
import { useLanguage } from '../contexts/LanguageContext';
import { useLocation as useSelectedCity } from '../contexts/LocationContext';
import { useSEO } from '../hooks/useSEO';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { listingDocumentTitle } from '../utils/documentTitle';
import ogImage from '../assets/ae3d44fbb2bace1359cf1d0dcf503ab46d8abef2.png';
import { CONTACT_EMAIL, SITE_URL } from '../config/siteConfig';

const UI_CONTACT_EMAIL = 'info@zipaagency.com';

export function ContactPage() {
  const { t } = useT();
  const { language } = useLanguage();
  const { selectedCity } = useSelectedCity();
  const contactPageName = language === 'sr' ? 'Kontakt' : 'Contact';
  useDocumentTitle(listingDocumentTitle(contactPageName, selectedCity));

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    message: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // SEO optimization
  useSEO({
    title: t('seoContactTitle'),
    description: t('seoContactDescription'),
    keywords: t('seoContactKeywords'),
    ogImage: ogImage,
    ogType: 'website',
    canonical: SITE_URL + '/contact'
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    const serviceId = import.meta.env.VITE_EMAILJS_SERVICE_ID?.trim() ?? '';
    const templateId = import.meta.env.VITE_EMAILJS_TEMPLATE_ID?.trim() ?? '';
    const publicKey = import.meta.env.VITE_EMAILJS_PUBLIC_KEY?.trim() ?? '';

    setSubmitError(null);
    setSubmitSuccess(false);

    if (!serviceId || !templateId || !publicKey) {
      setSubmitError(t('contactFormMissingConfig'));
      return;
    }

    setIsSubmitting(true);

    const templateParams = {
      from_name: formData.name.trim(),
      from_email: formData.email.trim(),
      phone: formData.phone.trim(),
      subject: `${t('contactPageTitle')} — ${formData.name.trim()}`,
      message: formData.message.trim(),
      to_email: CONTACT_EMAIL,
    };

    try {
      await emailjs.send(serviceId, templateId, templateParams, { publicKey });
      setSubmitSuccess(true);
      setFormData({ name: '', email: '', phone: '', message: '' });
      window.setTimeout(() => {
        setSubmitSuccess(false);
      }, 5000);
    } catch (error) {
      console.error('EMAILJS ERROR:', error);
      if (error && typeof error === 'object') {
        const emailJsError = error as { text?: unknown; message?: unknown; status?: unknown };
        console.error('EMAILJS ERROR DETAILS:', {
          text: emailJsError.text,
          message: emailJsError.message,
          status: emailJsError.status,
        });

        const debugDetail =
          typeof emailJsError.text === 'string'
            ? emailJsError.text
            : typeof emailJsError.message === 'string'
              ? emailJsError.message
              : null;

        setSubmitError(
          import.meta.env.DEV && debugDetail
            ? `${t('contactFormSendError')} (${debugDetail})`
            : t('contactFormSendError')
        );
      } else {
        setSubmitError(t('contactFormSendError'));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Hero Section - Naslov i Opis */}
      <section className="w-full py-16 bg-white">
        <div className="max-w-[1280px] mx-auto px-4 text-center">
          <h1 
            style={{
              fontSize: '42px',
              fontWeight: 700,
              lineHeight: '1.2',
              color: '#1a2332',
              marginBottom: '16px'
            }}
          >
            {t('contactPageTitle')}
          </h1>
          <p 
            style={{
              fontSize: '16px',
              color: '#5A6C7D',
              lineHeight: '1.6',
              maxWidth: '700px',
              margin: '0 auto'
            }}
          >
            {t('contactSubtitle')}
          </p>
        </div>
      </section>

      {/* Main Content - 2 Kolone */}
      <div className="w-full max-w-[1100px] mx-auto px-4 pb-16">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* LIJEVO - FORMA */}
          <div>
            <div className="bg-white">
              {submitSuccess && (
                <div 
                  className="mb-6 p-4 rounded-lg"
                  style={{
                    backgroundColor: '#E8F5E9',
                    border: '1px solid #4CAF50',
                    color: '#2E7D32'
                  }}
                >
                  {t('formSubmitted')}
                </div>
              )}

              {submitError && (
                <div
                  className="mb-6 p-4 rounded-lg"
                  style={{
                    backgroundColor: '#FFEBEE',
                    border: '1px solid #EF5350',
                    color: '#C62828'
                  }}
                  role="alert"
                >
                  {submitError}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5">
                {/* Ime i prezime */}
                <div>
                  <label 
                    htmlFor="name" 
                    className="block mb-2"
                    style={{ fontSize: '14px', fontWeight: 500, color: '#1a1a1a' }}
                  >
                    {t('contactName')} <span style={{ color: '#DC2626' }}>*</span>
                  </label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    required
                    className="w-full px-4 py-3 border rounded-lg outline-none focus:border-blue-500 transition-colors"
                    style={{
                      borderColor: '#E5E9F0',
                      fontSize: '15px'
                    }}
                    placeholder={t('contactNamePlaceholder')}
                  />
                </div>

                {/* Email */}
                <div>
                  <label 
                    htmlFor="email" 
                    className="block mb-2"
                    style={{ fontSize: '14px', fontWeight: 500, color: '#1a1a1a' }}
                  >
                    {t('contactEmail')} <span style={{ color: '#DC2626' }}>*</span>
                  </label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    required
                    className="w-full px-4 py-3 border rounded-lg outline-none focus:border-blue-500 transition-colors"
                    style={{
                      borderColor: '#E5E9F0',
                      fontSize: '15px'
                    }}
                    placeholder={t('contactEmailPlaceholder')}
                  />
                </div>

                {/* Telefon */}
                <div>
                  <label 
                    htmlFor="phone" 
                    className="block mb-2"
                    style={{ fontSize: '14px', fontWeight: 500, color: '#1a1a1a' }}
                  >
                    {t('contactPhone')} <span style={{ color: '#DC2626' }}>*</span>
                  </label>
                  <input
                    type="tel"
                    id="phone"
                    name="phone"
                    value={formData.phone}
                    onChange={handleInputChange}
                    required
                    className="w-full px-4 py-3 border rounded-lg outline-none focus:border-blue-500 transition-colors"
                    style={{
                      borderColor: '#E5E9F0',
                      fontSize: '15px'
                    }}
                    placeholder={t('contactPhonePlaceholder')}
                  />
                </div>

                {/* Poruka */}
                <div>
                  <label 
                    htmlFor="message" 
                    className="block mb-2"
                    style={{ fontSize: '14px', fontWeight: 500, color: '#1a1a1a' }}
                  >
                    {t('contactMessage')} <span style={{ color: '#DC2626' }}>*</span>
                  </label>
                  <textarea
                    id="message"
                    name="message"
                    value={formData.message}
                    onChange={handleInputChange}
                    required
                    rows={5}
                    className="w-full px-4 py-3 border rounded-lg outline-none focus:border-blue-500 transition-colors resize-none"
                    style={{
                      borderColor: '#E5E9F0',
                      fontSize: '15px'
                    }}
                    placeholder={t('contactMessagePlaceholder')}
                  />
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3 rounded-lg transition-all hover:opacity-90 disabled:opacity-50"
                  style={{
                    background: 'linear-gradient(135deg, #60A5FA 0%, #0E3DC5 100%)',
                    color: 'white',
                    fontSize: '16px',
                    fontWeight: 600,
                    border: 'none',
                    cursor: isSubmitting ? 'not-allowed' : 'pointer'
                  }}
                >
                  {isSubmitting ? t('sending') : t('submit')}
                </button>

                {/* Napomena */}
                <p 
                  style={{ 
                    fontSize: '13px', 
                    color: '#6B7280', 
                    textAlign: 'center',
                    marginTop: '12px'
                  }}
                >
                  <span style={{ color: '#DC2626' }}>*</span> {t('allFieldsRequired')}
                </p>
              </form>
            </div>
          </div>

          {/* DESNO - KONTAKT INFORMACIJE */}
          <div>
            <h3 
              className="mb-6" 
              style={{ fontSize: '20px', fontWeight: 600, color: '#1a1a1a' }}
            >
              {t('contactInfo')}
            </h3>

            <div className="space-y-6 mb-8">
              {/* Telefon */}
              <div className="flex items-start gap-4">
                <div 
                  className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: '#E8F0FE' }}
                >
                  <Phone size={20} style={{ color: '#0E3DC5' }} />
                </div>
                <div>
                  <h4 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '4px', color: '#1a1a1a' }}>
                    {t('phone')}
                  </h4>
                  <p style={{ fontSize: '14px', color: '#0E3DC5', fontWeight: 500 }}>
                    +387 65 123 4567
                  </p>
                </div>
              </div>

              {/* Email */}
              <div className="flex items-start gap-4">
                <div 
                  className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: '#E8F0FE' }}
                >
                  <Mail size={20} style={{ color: '#0E3DC5' }} />
                </div>
                <div>
                  <h4 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '4px', color: '#1a1a1a' }}>
                    Email
                  </h4>
                  <p style={{ fontSize: '14px', color: '#0E3DC5', fontWeight: 500 }}>
                    <a href={`mailto:${UI_CONTACT_EMAIL}`} style={{ color: 'inherit', fontWeight: 500 }}>
                      {UI_CONTACT_EMAIL}
                    </a>
                  </p>
                </div>
              </div>

              {/* Adresa */}
              <div className="flex items-start gap-4">
                <div 
                  className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: '#E8F0FE' }}
                >
                  <MapPin size={20} style={{ color: '#0E3DC5' }} />
                </div>
                <div>
                  <h4 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '4px', color: '#1a1a1a' }}>
                    {t('address')}
                  </h4>
                  <p style={{ fontSize: '14px', color: '#5A6C7D', lineHeight: '1.5' }}>
                    {t('zipaStreet')}<br />
                    {t('zipaCity')}
                  </p>
                </div>
              </div>
            </div>

            {/* Radno vrijeme */}
            <div 
              className="p-5 rounded-lg"
              style={{ backgroundColor: '#F9FAFB', border: '1px solid #E5E9F0' }}
            >
              <h4 
                className="mb-4" 
                style={{ fontSize: '16px', fontWeight: 600, color: '#1a1a1a' }}
              >
                {t('workingHours')}
              </h4>

              <div className="space-y-3">
                <div className="flex justify-between">
                  <span style={{ fontSize: '14px', color: '#1a1a1a' }}>
                    {t('monday')} - {t('friday')}:
                  </span>
                  <span style={{ fontSize: '14px', fontWeight: 600, color: '#1a1a1a' }}>
                    09:00 - 17:00
                  </span>
                </div>
                <div className="flex justify-between">
                  <span style={{ fontSize: '14px', color: '#1a1a1a' }}>
                    {t('saturday')}:
                  </span>
                  <span style={{ fontSize: '14px', fontWeight: 600, color: '#1a1a1a' }}>
                    10:00 - 14:00
                  </span>
                </div>
                <div className="flex justify-between">
                  <span style={{ fontSize: '14px', color: '#1a1a1a' }}>
                    {t('sunday')}:
                  </span>
                  <span style={{ fontSize: '14px', color: '#9CA3AF' }}>
                    {t('closed')}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}