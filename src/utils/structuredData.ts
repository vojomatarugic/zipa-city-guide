// Structured Data (Schema.org) helpers for rich snippets

import { CONTACT_EMAIL, SITE_URL } from "../config/siteConfig";

export const getOrganizationSchema = () => ({
  "@context": "https://schema.org",
  "@type": "Organization",
  "@id": SITE_URL + "/#organization",
  "name": "Zipa City Guide",
  "url": SITE_URL,
  "logo": SITE_URL + "/logo.png",
  "description": "Kompletan turistički vodič kroz Banja Luku - restorani, dešavanja, noćni život, smještaj i znamenitosti.",
  "address": {
    "@type": "PostalAddress",
    "addressLocality": "Banja Luka",
    "addressRegion": "Republika Srpska",
    "addressCountry": "BA"
  },
  "contactPoint": {
    "@type": "ContactPoint",
    "contactType": "Customer Service",
    "email": CONTACT_EMAIL
  }
});

export const getTouristDestinationSchema = () => ({
  "@context": "https://schema.org",
  "@type": "TouristDestination",
  "@id": SITE_URL + "/#touristDestination",
  "name": "Banja Luka",
  "description": "Drugi po veličini grad u Bosni i Hercegovini, poznat po kulturnim znamenitostima, restoranima i noćnom životu.",
  "url": SITE_URL,
  "touristType": [
    "Culture enthusiasts",
    "Food lovers",
    "History buffs",
    "Urban explorers"
  ],
  "address": {
    "@type": "PostalAddress",
    "addressLocality": "Banja Luka",
    "addressRegion": "Republika Srpska",
    "addressCountry": "BA"
  }
});

export const getWebSiteSchema = () => ({
  "@context": "https://schema.org",
  "@type": "WebSite",
  "@id": SITE_URL + "/#website",
  "name": "Zipa City Guide",
  "url": SITE_URL,
  "description": "Otkrijte najbolje restorane, dešavanja, noćni život, smještaj i znamenitosti Banjaluke.",
  "inLanguage": ["sr-Latn", "en"],
  "potentialAction": {
    "@type": "SearchAction",
    "target": SITE_URL + "/search?q={search_term_string}",
    "query-input": "required name=search_term_string"
  }
});

export const getBreadcrumbSchema = (items: { name: string; url: string }[]) => ({
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": items.map((item, index) => ({
    "@type": "ListItem",
    "position": index + 1,
    "name": item.name,
    "item": item.url
  }))
});

export const getRestaurantSchema = (restaurant: {
  name: string;
  description: string;
  image?: string;
  address?: string;
  cuisine?: string;
  priceRange?: string;
  rating?: number;
}) => ({
  "@context": "https://schema.org",
  "@type": "Restaurant",
  "name": restaurant.name,
  "description": restaurant.description,
  "image": restaurant.image,
  "address": {
    "@type": "PostalAddress",
    "streetAddress": restaurant.address,
    "addressLocality": "Banja Luka",
    "addressRegion": "Republika Srpska",
    "addressCountry": "BA"
  },
  "servesCuisine": restaurant.cuisine,
  "priceRange": restaurant.priceRange,
  "aggregateRating": restaurant.rating ? {
    "@type": "AggregateRating",
    "ratingValue": restaurant.rating,
    "bestRating": "5",
    "worstRating": "1"
  } : undefined
});

export const getEventSchema = (event: {
  name: string;
  description: string;
  startDate: string;
  endDate?: string;
  location: string;
  image?: string;
  price?: string;
}) => ({
  "@context": "https://schema.org",
  "@type": "Event",
  "name": event.name,
  "description": event.description,
  "startDate": event.startDate,
  "endDate": event.endDate,
  "eventStatus": "https://schema.org/EventScheduled",
  "eventAttendanceMode": "https://schema.org/OfflineEventAttendanceMode",
  "location": {
    "@type": "Place",
    "name": event.location,
    "address": {
      "@type": "PostalAddress",
      "addressLocality": "Banja Luka",
      "addressRegion": "Republika Srpska",
      "addressCountry": "BA"
    }
  },
  "image": event.image,
  "offers": event.price ? {
    "@type": "Offer",
    "price": event.price,
    "priceCurrency": "BAM",
    "availability": "https://schema.org/InStock"
  } : undefined
});

export const getAccommodationSchema = (accommodation: {
  name: string;
  description: string;
  address?: string;
  image?: string;
  priceRange?: string;
  rating?: number;
}) => ({
  "@context": "https://schema.org",
  "@type": "Hotel",
  "name": accommodation.name,
  "description": accommodation.description,
  "image": accommodation.image,
  "address": {
    "@type": "PostalAddress",
    "streetAddress": accommodation.address,
    "addressLocality": "Banja Luka",
    "addressRegion": "Republika Srpska",
    "addressCountry": "BA"
  },
  "priceRange": accommodation.priceRange,
  "aggregateRating": accommodation.rating ? {
    "@type": "AggregateRating",
    "ratingValue": accommodation.rating,
    "bestRating": "5",
    "worstRating": "1"
  } : undefined
});

export const getTouristAttractionSchema = (attraction: {
  name: string;
  description: string;
  address?: string;
  image?: string;
}) => ({
  "@context": "https://schema.org",
  "@type": "TouristAttraction",
  "name": attraction.name,
  "description": attraction.description,
  "image": attraction.image,
  "address": {
    "@type": "PostalAddress",
    "streetAddress": attraction.address,
    "addressLocality": "Banja Luka",
    "addressRegion": "Republika Srpska",
    "addressCountry": "BA"
  }
});
