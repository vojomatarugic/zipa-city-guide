import { useState, useEffect } from "react";
import { Link } from "react-router";
import { Header } from "../components/Header";
import { Footer } from "../components/Footer";
import { EventCard, EventCardSkeleton } from "../components/EventCard";
import { UnderConstruction } from "../components/UnderConstruction";
import { CalendarDays } from "lucide-react";
import { useT } from "../hooks/useT";
import { useLanguage } from "../contexts/LanguageContext";
import { useLocation } from "../contexts/LocationContext";
import { useSEO } from "../hooks/useSEO";
import { getBreadcrumbSchema } from "../utils/structuredData";
import * as eventService from "../utils/eventService";
import { Item } from "../utils/dataService";
import ogImage from "../assets/ae3d44fbb2bace1359cf1d0dcf503ab46d8abef2.png";
import eventsHeroImage from "../assets/55c8d14367570f30de708fa478fd6a7489c658c9.png";

export function EventsPage() {
  const { t } = useT();
  const { language } = useLanguage();
  const { selectedCity } = useLocation();
  const [events, setEvents] = useState<Item[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [interestCounts, setInterestCounts] = useState<Record<string, number>>({});

  // Fetch events from database
  useEffect(() => {
    async function fetchEvents() {
      setIsLoading(true);
      const fetchedEvents = await eventService.getEvents(
        'upcoming',
        selectedCity
      );
      setEvents(fetchedEvents);
      setIsLoading(false);

      // Fetch interest counts for free events
      const freeIds = fetchedEvents
        .filter(e => /^(free|besplatn|gratis)/i.test(e.price || '') || /^(free|besplatn|gratis)/i.test(e.price_en || ''))
        .map(e => e.id);
      if (freeIds.length > 0) {
        const counts = await eventService.batchGetInterestCounts(freeIds);
        setInterestCounts(counts);
      }
    }
    fetchEvents();
  }, [selectedCity]);

  // SEO
  useSEO({
    title: t("seoEventsTitle"),
    description: t("seoEventsDescription"),
    keywords: t("seoEventsKeywords"),
    ogImage: ogImage,
    ogType: "website",
    canonical: "https://blcityguide.com/events",
    structuredData: {
      "@context": "https://schema.org",
      "@graph": [
        getBreadcrumbSchema([
          { name: "Home", url: "https://blcityguide.com/" },
          { name: "Dešavanja", url: "https://blcityguide.com/events" },
        ]),
        {
          "@type": "ItemList",
          name: "Dešavanja u Banjoj Luci",
          description: "Lista trenutnih i nadolazećih događaja u Banjoj Luci",
          numberOfItems: events.length,
        },
      ],
    },
  });

  // Split events into sections
  const featuredEvents = events.slice(0, 4);
  const upcomingEvents = events.slice(4, 10);
  const nearbyEvents = events.filter(e => e.city && e.city !== 'Banja Luka').slice(0, 4);

  return (
    <div className="min-h-screen" style={{ background: "#FFFFFF" }}>
      <Header />

      {/* HERO SECTION */}
      <section
        className="relative w-full"
        style={{
          height: "420px",
          background: `linear-gradient(rgba(255, 107, 53, 0.65), rgba(255, 107, 53, 0.65)), url('${eventsHeroImage}') center/cover`,
        }}
      >
        <div className="relative z-10 h-full flex flex-col items-center justify-center px-4">
          <h1
            className="text-center mb-3"
            style={{
              fontSize: "42px",
              fontWeight: 700,
              color: "#FFFFFF",
              textShadow: "0 0 20px rgba(255,255,255,0.8), 0 0 30px rgba(255,255,255,0.6), 3px 3px 10px rgba(0,0,0,0.9)",
            }}
          >
            {t("eventsPageTitle")}
          </h1>
          <p
            className="text-center"
            style={{
              fontSize: "18px",
              color: "#FFFFFF",
              textShadow: "0 0 15px rgba(255,255,255,0.7), 0 0 25px rgba(255,255,255,0.5), 2px 2px 8px rgba(0,0,0,0.9)",
              maxWidth: "600px",
              margin: "0 auto",
              whiteSpace: "nowrap",
            }}
          >
            {t("eventsPageDesc")}
          </p>
        </div>
      </section>

      {/* FEATURED EVENTS */}
      <section className="py-16" style={{ background: "#FFFFFF" }}>
        <div className="w-[60vw] mx-auto">
          <h2
            style={{
              fontSize: "24px",
              fontWeight: 600,
              color: "#FB8C00",
              marginBottom: "24px",
              textShadow: "0 2px 4px rgba(0, 0, 0, 0.1)",
            }}
          >
            {language === "sr" ? "Aktuelna dešavanja" : "Featured Events"}
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            {isLoading ? (
              <EventCardSkeleton count={4} imageHeight="350px" />
            ) : featuredEvents.length > 0 ? (
              featuredEvents.map((event) => (
                <EventCard
                  key={event.id}
                  event={event}
                  language={language}
                  accentColor="#FB8C00"
                  imageHeight="350px"
                  interestCount={interestCounts[event.id]}
                />
              ))
            ) : (
              <div className="col-span-4">
                <UnderConstruction language={language} accentColor="#FB8C00" icon={CalendarDays} />
              </div>
            )}
          </div>

          {/* CTA Button */}
          <div style={{ display: "flex", justifyContent: "center", marginTop: "40px" }}>
            <Link
              to="/events/all"
              style={{
                display: "inline-block",
                background: "#FB8C00",
                color: "#FFFFFF",
                padding: "14px 32px",
                borderRadius: "8px",
                fontSize: "16px",
                fontWeight: 600,
                textDecoration: "none",
                transition: "all 0.3s",
              }}
              className="hover:opacity-90"
            >
              {language === "sr" ? "Pogledaj sva dešavanja" : "View All Events"}
            </Link>
          </div>
        </div>
      </section>

      {/* UPCOMING EVENTS */}
      <section className="py-16" style={{ background: "#FFF5E6" }}>
        <div className="w-[60vw] mx-auto">
          <h2
            style={{
              fontSize: "24px",
              fontWeight: 600,
              color: "#FB8C00",
              marginBottom: "24px",
              textShadow: "0 2px 4px rgba(0, 0, 0, 0.1)",
            }}
          >
            {language === "sr" ? "Predstojeća dešavanja" : "Upcoming Events"}
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {isLoading ? (
              <EventCardSkeleton count={6} imageHeight="200px" />
            ) : upcomingEvents.length > 0 ? (
              upcomingEvents.map((event) => (
                <EventCard
                  key={event.id}
                  event={event}
                  language={language}
                  accentColor="#FB8C00"
                  imageHeight="200px"
                  interestCount={interestCounts[event.id]}
                />
              ))
            ) : (
              <div className="col-span-3">
                <UnderConstruction language={language} accentColor="#FB8C00" icon={CalendarDays} />
              </div>
            )}
          </div>
        </div>
      </section>

      {/* NEARBY EVENTS */}
      <section className="py-16" style={{ background: "#FFFFFF" }}>
        <div className="w-[60vw] mx-auto">
          <h2
            style={{
              fontSize: "24px",
              fontWeight: 600,
              color: "#FB8C00",
              marginBottom: "24px",
              textShadow: "0 2px 4px rgba(0, 0, 0, 0.1)",
            }}
          >
            {language === "sr" ? "Dešavanja u okolini" : "Nearby Events"}
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {nearbyEvents.length > 0 ? (
              nearbyEvents.map((event) => (
                <EventCard
                  key={event.id}
                  event={event}
                  language={language}
                  accentColor="#FB8C00"
                  imageHeight="200px"
                  interestCount={interestCounts[event.id]}
                />
              ))
            ) : (
              <div className="col-span-4">
                <UnderConstruction language={language} accentColor="#FB8C00" icon={CalendarDays} />
              </div>
            )}
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}