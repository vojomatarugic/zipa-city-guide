import { useState, useEffect, useLayoutEffect, useMemo } from "react";
import { Link, useSearchParams } from "react-router";
import { EventCard, EventCardSkeleton } from "../components/EventCard";
import { SectionEmptyState } from "../components/SectionEmptyState";
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
import { cityEquals, formatCityLabel } from "../utils/city";
import { RevealOnScrollArticle } from "../components/RevealOnScrollArticle";
import {
  LISTING_PAGE_CONTENT_SECTION_CLASS,
  LISTING_PAGE_HERO_SECTION_CLASS,
} from "../utils/listingPageLayout";

const CURRENT_MAX_CARDS = 4;
const FEATURED_MAX_CARDS = 6;
const OTHER_CITIES_MAX_CARDS = 4;

/** Skeleton + EventCard u istom gridu dijele visinu slike. */
const EVENTS_CURRENT_CARD_IMAGE_HEIGHT = "350px";
const EVENTS_COMPACT_CARD_IMAGE_HEIGHT = "200px";

function nextStartAtOrNull(event: Item, now: Date): Date | null {
  const slots = eventService.getEventScheduleSlots(event);
  const nextSlot = slots.find((slot) => new Date(slot.start_at) >= now);
  if (nextSlot) return new Date(nextSlot.start_at);
  return event.start_at && new Date(event.start_at) >= now
    ? new Date(event.start_at)
    : null;
}

function isNotFinished(event: Item, now: Date): boolean {
  const slots = eventService.getEventScheduleSlots(event);
  if (slots.length > 0) {
    return slots.some((slot) => new Date(slot.end_at || slot.start_at) >= now);
  }
  if (event.end_at) return new Date(event.end_at) >= now;
  if (event.start_at) return new Date(event.start_at) >= now;
  return false;
}

function sortByStartAtAsc(events: Item[], now: Date): Item[] {
  return [...events].sort((a, b) => {
    const aTime =
      nextStartAtOrNull(a, now)?.getTime() ?? Number.MAX_SAFE_INTEGER;
    const bTime =
      nextStartAtOrNull(b, now)?.getTime() ?? Number.MAX_SAFE_INTEGER;
    return aTime - bTime;
  });
}

function isFeaturedEvent(event: Item): boolean {
  const featured = event as Item & {
    is_featured?: boolean;
    featured?: boolean;
    starred?: boolean;
  };
  return Boolean(featured.is_featured || featured.featured || featured.starred);
}

export function EventsPage() {
  const { t } = useT();
  const { language } = useLanguage();
  const { selectedCity, setSelectedCity } = useLocation();
  const [searchParams] = useSearchParams();
  const [events, setEvents] = useState<Item[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [interestCounts, setInterestCounts] = useState<Record<string, number>>(
    {},
  );

  // URL `?city=` (npr. iz „Istraži ostale gradove” ili otvor u novom tabu) mora ući u kontekst
  // prije nego se lista isfiltrira po `selectedCity`.
  useLayoutEffect(() => {
    const raw = searchParams.get("city");
    if (!raw) return;
    const label = formatCityLabel(decodeURIComponent(raw));
    if (label) setSelectedCity(label);
  }, [searchParams, setSelectedCity]);

  // Fetch events from database
  useEffect(() => {
    async function fetchEvents() {
      setIsLoading(true);
      const fetchedEvents = await eventService.getEvents(
        "all",
        undefined,
        undefined,
        "events",
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

  const { currentEvents, featuredEvents, otherCitiesEvents } = useMemo(() => {
    const now = new Date();

    const baseEvents = events.filter(
      (event) =>
        event.status === "approved" &&
        getTopLevelPageCategory(event) === "events" &&
        isNotFinished(event, now),
    );

    const localEvents = baseEvents.filter((event) =>
      cityEquals(event.city, selectedCity),
    );

    const eligibleCurrentEvents = sortByStartAtAsc(
      localEvents.filter((event) => {
        const nextStart = nextStartAtOrNull(event, now);
        return Boolean(nextStart && nextStart >= now);
      }),
      now,
    );

    const starredEvents = sortByStartAtAsc(
      eligibleCurrentEvents.filter((event) => isFeaturedEvent(event)),
      now,
    );
    const featuredSelected = starredEvents.slice(0, FEATURED_MAX_CARDS);
    const featuredIds = new Set(featuredSelected.map((event) => event.id));

    const featuredFallback = eligibleCurrentEvents.filter(
      (event) => !featuredIds.has(event.id),
    );
    const finalFeaturedEvents = [...featuredSelected].concat(
      featuredFallback.slice(
        0,
        Math.max(FEATURED_MAX_CARDS - featuredSelected.length, 0),
      ),
    );
    const usedFeaturedIds = new Set(finalFeaturedEvents.map((event) => event.id));

    const currentEvents = eligibleCurrentEvents
      .filter((event) => !usedFeaturedIds.has(event.id))
      .slice(0, CURRENT_MAX_CARDS);

    const otherCitiesEvents = sortByStartAtAsc(
      baseEvents.filter((event) => !cityEquals(event.city, selectedCity)),
      now,
    ).slice(0, OTHER_CITIES_MAX_CARDS);

    return {
      currentEvents,
      featuredEvents: finalFeaturedEvents,
      otherCitiesEvents,
    };
  }, [events, selectedCity]);

  return (
    <div className="min-h-screen" style={{ background: "#FFFFFF" }}>
      {/* HERO SECTION */}
      <section
        className={LISTING_PAGE_HERO_SECTION_CLASS}
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

      {/* CURRENT EVENTS */}
      <section
        className={LISTING_PAGE_CONTENT_SECTION_CLASS}
        style={{ background: "#FFFFFF" }}
      >
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
            {language === "sr" ? "Aktuelna dešavanja" : "Current Events"}
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            {isLoading ? (
              <EventCardSkeleton
                count={4}
                imageHeight={EVENTS_CURRENT_CARD_IMAGE_HEIGHT}
              />
            ) : currentEvents.length > 0 ? (
              currentEvents.map((event) => (
                <RevealOnScrollArticle key={event.id}>
                  <EventCard
                    event={event}
                    language={language}
                    accentColor={EVENTS_CATEGORY_THEME.accentColor}
                    imageHeight={EVENTS_CURRENT_CARD_IMAGE_HEIGHT}
                    interestCount={interestCounts[event.id]}
                  />
                </RevealOnScrollArticle>
              ))
            ) : (
              <div className="col-span-4">
                <SectionEmptyState
                  icon={CalendarDays}
                  accentColor={EVENTS_CATEGORY_THEME.accentColor}
                  message={language === "sr" ? "Trenutno nema sadržaja u ovoj sekciji." : "There is currently no content in this section."}
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

      {/* FEATURED EVENTS */}
      <section
        className={LISTING_PAGE_CONTENT_SECTION_CLASS}
        style={{ background: "#FFF5E6" }}
      >
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
            {language === "sr" ? "Istaknuta dešavanja" : "Featured Events"}
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {isLoading ? (
              <EventCardSkeleton
                count={6}
                imageHeight={EVENTS_COMPACT_CARD_IMAGE_HEIGHT}
              />
            ) : featuredEvents.length > 0 ? (
              featuredEvents.map((event) => (
                <RevealOnScrollArticle key={event.id}>
                  <EventCard
                    event={event}
                    language={language}
                    accentColor={EVENTS_CATEGORY_THEME.accentColor}
                    imageHeight={EVENTS_COMPACT_CARD_IMAGE_HEIGHT}
                    interestCount={interestCounts[event.id]}
                  />
                </RevealOnScrollArticle>
              ))
            ) : (
              <div className="col-span-3">
                <SectionEmptyState
                  icon={CalendarDays}
                  accentColor={EVENTS_CATEGORY_THEME.accentColor}
                  message={language === "sr" ? "Trenutno nema sadržaja u ovoj sekciji." : "There is currently no content in this section."}
                />
              </div>
            )}
          </div>
        </div>
      </section>

      {/* EVENTS FROM OTHER CITIES */}
      <section
        className={LISTING_PAGE_CONTENT_SECTION_CLASS}
        style={{ background: "#FFFFFF" }}
      >
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
            {language === "sr"
              ? "Dešavanja u ostalim gradovima"
              : "Events from other cities"}
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {isLoading ? (
              <EventCardSkeleton
                count={4}
                imageHeight={EVENTS_COMPACT_CARD_IMAGE_HEIGHT}
              />
            ) : otherCitiesEvents.length > 0 ? (
              otherCitiesEvents.map((event) => (
                <RevealOnScrollArticle key={event.id}>
                  <EventCard
                    event={event}
                    language={language}
                    accentColor={EVENTS_CATEGORY_THEME.accentColor}
                    imageHeight={EVENTS_COMPACT_CARD_IMAGE_HEIGHT}
                    interestCount={interestCounts[event.id]}
                    showCity
                    showVenue
                    showDate
                    showTime
                    metadataOrder={["city", "venue", "date", "time"]}
                  />
                </RevealOnScrollArticle>
              ))
            ) : (
              <div className="col-span-4">
                <SectionEmptyState
                  icon={CalendarDays}
                  accentColor={EVENTS_CATEGORY_THEME.accentColor}
                  message={language === "sr" ? "Trenutno nema sadržaja u ovoj sekciji." : "There is currently no content in this section."}
                />
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
