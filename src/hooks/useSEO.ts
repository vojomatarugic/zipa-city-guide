import { useEffect } from 'react';

interface SEOProps {
  title: string;
  description: string;
  keywords?: string;
  ogImage?: string;
  ogType?: string;
  canonical?: string;
  structuredData?: object;
}

export function useSEO({
  title,
  description,
  keywords,
  ogImage,
  ogType = 'website',
  canonical,
  structuredData
}: SEOProps) {
  useEffect(() => {
    // document.title is managed centrally via useDocumentTitle + utils/documentTitle

    // Set or update meta tags
    const setMetaTag = (property: string, content: string, isProperty = true) => {
      const attribute = isProperty ? 'property' : 'name';
      let meta = document.querySelector(`meta[${attribute}="${property}"]`) as HTMLMetaElement;
      if (!meta) {
        meta = document.createElement('meta');
        meta.setAttribute(attribute, property);
        document.head.appendChild(meta);
      }
      meta.setAttribute('content', content);
    };

    // Primary meta tags
    setMetaTag('description', description, false);
    if (keywords) {
      setMetaTag('keywords', keywords, false);
    }
    
    // Open Graph / Facebook
    setMetaTag('og:type', ogType);
    setMetaTag('og:title', title);
    setMetaTag('og:description', description);
    if (ogImage) {
      setMetaTag('og:image', ogImage);
    }
    if (canonical) {
      setMetaTag('og:url', canonical);
    }
    
    // Twitter
    setMetaTag('twitter:card', 'summary_large_image');
    setMetaTag('twitter:title', title);
    setMetaTag('twitter:description', description);
    if (ogImage) {
      setMetaTag('twitter:image', ogImage);
    }
    
    // Canonical URL
    if (canonical) {
      let link = document.querySelector('link[rel="canonical"]') as HTMLLinkElement;
      if (!link) {
        link = document.createElement('link');
        link.rel = 'canonical';
        document.head.appendChild(link);
      }
      link.href = canonical;
    }
    
    // Structured Data (JSON-LD)
    if (structuredData) {
      let script = document.querySelector('script[type="application/ld+json"]#structured-data') as HTMLScriptElement;
      if (!script) {
        script = document.createElement('script');
        script.type = 'application/ld+json';
        script.id = 'structured-data';
        document.head.appendChild(script);
      }
      script.textContent = JSON.stringify(structuredData);
    }
  }, [title, description, keywords, ogImage, ogType, canonical, structuredData]);
}
