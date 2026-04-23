import { useState, useEffect } from "react";
import { Link } from "react-router";
import { EventCard, EventCardSkeleton } from "../components/EventCard";
import { UnderConstruction } from "../components/UnderConstruction";
import { CalendarDays } from "lucide-react";
import { useT } from "../hooks/useT";
import { useLanguage } from "../contexts/LanguageContext";
import { useLocation } from "../contexts/LocationContext";
import { useSEO } from "../hooks/useSEO";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import { DOC_TITLE_EVENTS, listingDocumentTitle } from "../utils/documentTitle";
import { getBreadcrumbSchema } from "../utils/structuredData";
import { SITE_URL } from "../config/siteConfig";
import * as eventService from "../utils/eventService";
import { Item } from "../utils/dataService";
const ogImage = "/zipa-city-guide-OG.png";
import eventsHeroImage from "../assets/events-hero.png";
import {
  EVENTS_CATEGORY_THEME,
  EVENTS_HERO_OVERLAY_GRADIENT,
} from "../utils/categoryThemes";
import { getTopLevelPageCategory } from "../utils/eventPageCategory";

export function EventsPage() {
  const { t } = useT();
  const { language } = useLanguage();
  const { selectedCity } = useLocation();
  const [events, setEvents] = useState<Item[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [interestCounts, setInterestCounts] = useState<Record<string, number>>(
    {},
  );

  // Fetch events from database
  useEffect(() => {
    async function fetchEvents() {
      setIsLoading(true);
      const fetchedEvents = await eventService.getEvents(
        "upcoming",
        selectedCity,
      );
      const eventsBucket = fetchedEvents.filter(
        (e) => getTopLevelPageCategory(e) === "events",
      );
      setEvents(eventsBucket);
      setIsLoading(false);

      // Fetch interest counts for free events
      const freeIds = eventsBucket
        .filter((e) => /^(free|besplatn|gratis)/i.test(e.price || ""))
        .map((e) => e.id);
      if (freeIds.length > 0) {
        const counts = await eventService.batchGetInterestCounts(freeIds);
        setInterestCounts(counts);
      }
    }
    fetchEvents();
  }, [selectedCity]);

  useDocumentTitle(listingDocumentTitle(DOC_TITLE_EVENTS, selectedCity));

  // SEO
  useSEO({
    title: t("seoEventsTitle"),
    description: t("seoEventsDescription"),
    keywords: t("seoEventsKeywords"),
    ogImage: ogImage,
    ogType: "website",
    canonical: SITE_URL + "/events",
    structuredData: {
      "@context": "https://schema.org",
      "@graph": [
        getBreadcrumbSchema([
          { name: "Home", url: SITE_URL + "/" },
          { name: "Dešavanja", url: SITE_URL + "/events" },
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
  const nearbyEvents = events
    .filter((e) => e.city && e.city !== "Banja Luka")
    .slice(0, 4);

  return (
    <div className="min-h-screen" style={{ background: "#FFFFFF" }}>
      {/* HERO SECTION */}
      <section
        className="relative w-full"
        style={{
          height: "420px",
          background: `${EVENTS_HERO_OVERLAY_GRADIENT}, url('${eventsHeroImage}') center/cover`,
        }}
      >
        <div className="relative z-10 h-full flex flex-col items-center justify-center px-4">
          <h1
            className="text-center mb-3"
            style={{
              fontSize: "42px",
              fontWeight: 700,
              color: "#FFFFFF",
              textShadow:
                "0 0 20px rgba(255,255,255,0.8), 0 0 30px rgba(255,255,255,0.6), 3px 3px 10px rgba(0,0,0,0.9)",
            }}
          >
            {t("eventsPageTitle")}
          </h1>
          <p
            className="text-center"
            style={{
              fontSize: "18px",
              color: "#FFFFFF",
              textShadow:
                "0 0 15px rgba(255,255,255,0.7), 0 0 25px rgba(255,255,255,0.5), 2px 2px 8px rgba(0,0,0,0.9)",
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
              color: EVENTS_CATEGORY_THEME.accentColor,
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
                  accentColor={EVENTS_CATEGORY_THEME.accentColor}
                  imageHeight="350px"
                  interestCount={interestCounts[event.id]}
                />
              ))
            ) : (
              <div className="col-span-4">
                <UnderConstruction
                  language={language}
                  accentColor={EVENTS_CATEGORY_THEME.accentColor}
                  icon={CalendarDays}
                />
              </div>
            )}
          </div>

          {/* CTA Button */}
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              marginTop: "40px",
            }}
          >
            <Link
              to="/events/all"
              style={{
                display: "inline-block",
                background: EVENTS_CATEGORY_THEME.ctaBackground,
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
              color: EVENTS_CATEGORY_THEME.accentColor,
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
                  accentColor={EVENTS_CATEGORY_THEME.accentColor}
                  imageHeight="200px"
                  interestCount={interestCounts[event.id]}
                />
              ))
            ) : (
              <div className="col-span-3">
                <UnderConstruction
                  language={language}
                  accentColor={EVENTS_CATEGORY_THEME.accentColor}
                  icon={CalendarDays}
                />
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
              color: EVENTS_CATEGORY_THEME.accentColor,
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
                  accentColor={EVENTS_CATEGORY_THEME.accentColor}
                  imageHeight="200px"
                  interestCount={interestCounts[event.id]}
                />
              ))
            ) : (
              <div className="col-span-4">
                <UnderConstruction
                  language={language}
                  accentColor={EVENTS_CATEGORY_THEME.accentColor}
                  icon={CalendarDays}
                />
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
