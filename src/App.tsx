import { useEffect } from 'react';
import { RouterProvider } from 'react-router';
import { router } from './routes';
import { LanguageProvider } from './contexts/LanguageContext';
import { LocationProvider } from './contexts/LocationContext';
import { AuthProvider } from './contexts/AuthContext';
import ogImage from './assets/ae3d44fbb2bace1359cf1d0dcf503ab46d8abef2.png';
import { Toaster } from 'sonner@2.0.3';

// Force rebuild after backend ?? fix
export default function App() {
  // Set meta tags for SEO and social sharing
  useEffect(() => {
    try {
      const appTitle = 'ZIPA City Guide';
      const appDescription = 'Otkrij najbolje događaje i mjesta u svom gradu';

      // Set page title
      document.title = appTitle;
      
      // Set or update meta tags
      const setMetaTag = (property: string, content: string, isProperty = true) => {
        const attribute = isProperty ? 'property' : 'name';
        let meta = document.querySelector(`meta[${attribute}=\"${property}\"]`) as HTMLMetaElement;
        if (!meta) {
          meta = document.createElement('meta');
          meta.setAttribute(attribute, property);
          document.head.appendChild(meta);
        }
        meta.setAttribute('content', content);
      };

      // Primary meta tags
      setMetaTag('description', appDescription, false);
      setMetaTag('keywords', 'Banja Luka, turizam, restorani, noćni život, dešavanja, vodič, Republika Srpska, kultura, magazin', false);
      setMetaTag('author', 'ZIPA Agency', false);
      
      // Open Graph / Facebook
      setMetaTag('og:type', 'website');
      setMetaTag('og:url', 'https://blcityguide.com/');
      setMetaTag('og:title', appTitle);
      setMetaTag('og:description', appDescription);
      setMetaTag('og:image', ogImage);
      setMetaTag('og:image:width', '1200');
      setMetaTag('og:image:height', '630');
      
      // Twitter
      setMetaTag('twitter:card', 'summary_large_image');
      setMetaTag('twitter:url', 'https://blcityguide.com/');
      setMetaTag('twitter:title', appTitle);
      setMetaTag('twitter:description', appDescription);
      setMetaTag('twitter:image', ogImage);
      
      // Theme color
      setMetaTag('theme-color', '#0E3DC5', false);
      
      // ===== COMPREHENSIVE FAVICON SETUP - ZIPA Logo =====
      
      // Helper function to create/update link tags
      const setLinkTag = (rel: string, href: string, type?: string, sizes?: string) => {
        let link = document.querySelector(`link[rel="${rel}"]`) as HTMLLinkElement;
        if (!link) {
          link = document.createElement('link');
          link.rel = rel;
          document.head.appendChild(link);
        }
        link.href = href;
        if (type) link.type = type;
        if (sizes) link.setAttribute('sizes', sizes);
      };
      
      // Main favicon (SVG for modern browsers)
      setLinkTag('icon', `/favicon.svg?v=${Date.now()}`, 'image/svg+xml');
      
      // Alternate favicon (96x96 for better compatibility)
      setLinkTag('alternate icon', `/favicon-96x96.svg?v=${Date.now()}`, 'image/svg+xml');
      
      // Apple Touch Icon (iOS devices - home screen)
      setLinkTag('apple-touch-icon', `/apple-touch-icon.svg?v=${Date.now()}`, 'image/svg+xml', '180x180');
      
      // Additional iOS meta tags
      setMetaTag('apple-mobile-web-app-capable', 'yes', false);
      setMetaTag('apple-mobile-web-app-status-bar-style', 'default', false);
      setMetaTag('apple-mobile-web-app-title', 'City Guide', false);
      
      // Web App Manifest
      setLinkTag('manifest', `/manifest.json?v=${Date.now()}`);
    } catch (error) {
      console.error('Error setting meta tags:', error);
    }
  }, []);

  return (
    <LanguageProvider>
      <LocationProvider>
        <AuthProvider>
          <Toaster 
            position="top-center" 
            richColors 
            closeButton
            toastOptions={{
              style: {
                fontFamily: 'inherit',
              },
            }}
          />
          <RouterProvider router={router} />
        </AuthProvider>
      </LocationProvider>
    </LanguageProvider>
  );
}