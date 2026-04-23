import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router";
import { Music } from "lucide-react";
import { EventCard, EventCardSkeleton } from "../components/EventCard";
import { SectionEmptyState } from "../components/SectionEmptyState";
import { useT } from "../hooks/useT";
import { useLanguage } from "../contexts/LanguageContext";
import { useSEO } from "../hooks/useSEO";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import { useLocation as useSelectedCity } from "../contexts/LocationContext";
import {
  DOC_TITLE_CONCERTS,
  listingDocumentTitle,
} from "../utils/documentTitle";
import { getBreadcrumbSchema } from "../utils/structuredData";
import { SITE_URL } from "../config/siteConfig";
import * as eventService from "../utils/eventService";
import { Item } from "../utils/dataService";
const ogImage = "/zipa-city-guide-OG.png";
import concertsHeroImage from "../assets/concerts-hero.png";
import { getTopLevelPageCategory } from "../utils/eventPageCategory";
import { cityEquals, normalizeCityForCompare } from "../utils/city";

const UPCOMING_MAX_CARDS = 4;
const FEATURED_MAX_CARDS = 3;
const OTHER_CITIES_MAX_CARDS = 4;

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

export function ConcertsPage() {
  const { t } = useT();
  const { language } = useLanguage();
  const { selectedCity } = useSelectedCity();
  const [events, setEvents] = useState<Item[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [interestCounts, setInterestCounts] = useState<Record<string, number>>(
    {},
  );

  useEffect(() => {
    async function fetchConcerts() {
      setIsLoading(true);
      const fetched = await eventService.getEvents("all", undefined, "concert");
      const concertOnly = fetched.filter(
        (e) => getTopLevelPageCategory(e) === "concerts",
      );
      setEvents(concertOnly);
      setIsLoading(false);

      const freeIds = concertOnly
        .filter((e) => /^(free|besplatn|gratis)/i.test(e.price || ""))
        .map((e) => e.id);
      if (freeIds.length > 0) {
        const counts = await eventService.batchGetInterestCounts(freeIds);
        setInterestCounts(counts);
      }
    }
    fetchConcerts();
  }, []);

  useDocumentTitle(listingDocumentTitle(DOC_TITLE_CONCERTS, selectedCity));

  useSEO({
    title: t("seoConcertsTitle"),
    description: t("seoConcertsDescription"),
    keywords: t("seoConcertsKeywords"),
    ogImage: ogImage,
    ogType: "website",
    canonical: SITE_URL + "/concerts",
    structuredData: {
      "@context": "https://schema.org",
      "@graph": [
        getBreadcrumbSchema([
          { name: "Home", url: SITE_URL + "/" },
          { name: "Koncerti", url: SITE_URL + "/concerts" },
        ]),
      ],
    },
  });

  const { upcomingConcerts, featuredConcerts, otherCitiesConcerts } =
    useMemo(() => {
      const now = new Date();
      const normalizedSelectedCity = normalizeCityForCompare(selectedCity);

      const baseConcerts = events.filter(
        (event) =>
          event.event_type === "concert" &&
          event.status === "approved" &&
          isNotFinished(event, now),
      );

      const localConcerts = baseConcerts.filter((event) =>
        cityEquals(event.city, normalizedSelectedCity),
      );

      const eligibleUpcomingConcerts = sortByStartAtAsc(
        localConcerts.filter((event) => {
          const nextStart = nextStartAtOrNull(event, now);
          return Boolean(nextStart && nextStart >= now);
        }),
        now,
      );

      const starredConcerts = sortByStartAtAsc(
        eligibleUpcomingConcerts.filter((event) => isFeaturedEvent(event)),
        now,
      );
      const featuredConcertsSelected = starredConcerts.slice(
        0,
        FEATURED_MAX_CARDS,
      );
      const featuredConcertIds = new Set(
        featuredConcertsSelected.map((event) => event.id),
      );

      const featuredFallbackConcerts = eligibleUpcomingConcerts.filter(
        (event) => !featuredConcertIds.has(event.id),
      );
      const finalFeaturedConcerts = [...featuredConcertsSelected].concat(
        featuredFallbackConcerts.slice(
          0,
          Math.max(FEATURED_MAX_CARDS - featuredConcertsSelected.length, 0),
        ),
      );
      const usedFeaturedIds = new Set(
        finalFeaturedConcerts.map((event) => event.id),
      );

      const upcomingConcerts = eligibleUpcomingConcerts
        .filter((event) => !usedFeaturedIds.has(event.id))
        .slice(0, UPCOMING_MAX_CARDS);

      const otherCitiesConcerts = sortByStartAtAsc(
        baseConcerts.filter(
          (event) => !cityEquals(event.city, normalizedSelectedCity),
        ),
        now,
      ).slice(0, OTHER_CITIES_MAX_CARDS);

      return {
        upcomingConcerts,
        featuredConcerts: finalFeaturedConcerts,
        otherCitiesConcerts,
      };
    }, [events, selectedCity]);

  return (
    <div className="min-h-screen" style={{ background: "#FFFFFF" }}>
      {/* HERO SECTION */}
      <section
        className="relative w-full min-h-[320px]"
        style={{ height: "420px", marginTop: 0 }}
      >
        <img
          src={concertsHeroImage}
          alt="Koncerti u Banjaluci"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(rgba(192, 202, 51, 0.5), rgba(0, 0, 0, 0.7))",
          }}
        />
        <div className="relative z-10 h-full flex flex-col justify-center items-center px-8 lg:px-24">
          <h1
            className="mb-3 text-center"
            style={{
              fontSize: "42px",
              fontWeight: 700,
              color: "#FFFFFF",
              textShadow:
                "0 0 20px rgba(255,255,255,0.8), 0 0 30px rgba(255,255,255,0.6), 3px 3px 10px rgba(0,0,0,0.9)",
            }}
          >
            {t("concertsPageHero")}
          </h1>
          <p
            className="text-[20px] max-w-[600px] text-center"
            style={{
              fontSize: "18px",
              color: "#FFFFFF",
              textShadow:
                "0 0 15px rgba(255,255,255,0.7), 0 0 25px rgba(255,255,255,0.5), 2px 2px 8px rgba(0,0,0,0.9)",
            }}
          >
            {language === "sr"
              ? "Scena bez pauze — od glavnih bina do klupskih svirki."
              : "Non-stop scene — from main stages to club gigs."}
          </p>
        </div>
      </section>

      {/* Upcoming Concerts */}
      <section
        className="py-16 min-h-[320px]"
        style={{ background: "#FFFFFF" }}
      >
        <div className="w-[60vw] mx-auto">
          <h2
            className="mb-4"
            style={{
              fontSize: "24px",
              fontWeight: 600,
              color: "#C0CA33",
              textShadow: "0 2px 4px rgba(0, 0, 0, 0.1)",
            }}
          >
            {language === "sr" ? "Predstojeći koncerti" : "Upcoming Concerts"}
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {isLoading ? (
              <EventCardSkeleton count={4} imageHeight="320px" />
            ) : upcomingConcerts.length > 0 ? (
              upcomingConcerts.map((event) => (
                <EventCard
                  key={event.id}
                  event={event}
                  language={language}
                  accentColor="#C0CA33"
                  imageHeight="320px"
                  interestCount={interestCounts[event.id]}
                  showCity={false}
                  showVenue
                  showDate
                  showTime
                  metadataOrder={["venue", "date", "time"]}
                />
              ))
            ) : (
              <div className="col-span-4">
                <SectionEmptyState
                  icon={Music}
                  accentColor="#C0CA33"
                  message={
                    language === "sr"
                      ? "Trenutno nema sadržaja u ovoj sekciji."
                      : "There is currently no content in this section."
                  }
                />
              </div>
            )}
          </div>

          {/* CTA Button */}
          <div className="mt-8 flex justify-center">
            <Link to="/concerts/all">
              <button
                className="px-8 py-3 rounded-md transition-all duration-300 hover:opacity-90 hover:shadow-lg"
                style={{
                  background: "#C0CA33",
                  color: "#FFFFFF",
                  fontSize: "16px",
                  fontWeight: 500,
                }}
              >
                {language === "sr"
                  ? "Pogledaj sve koncerte"
                  : "View All Concerts"}
              </button>
            </Link>
          </div>
        </div>
      </section>

      {/* Featured Concerts */}
      <section
        className="py-16 min-h-[320px]"
        style={{ background: "#F5F7E8" }}
      >
        <div className="w-[60vw] mx-auto">
          <h2
            className="text-left mb-6"
            style={{
              fontSize: "24px",
              fontWeight: 600,
              color: "#C0CA33",
              textShadow: "0 2px 4px rgba(0, 0, 0, 0.1)",
            }}
          >
            {language === "sr" ? "Istaknuti koncerti" : "Featured Concerts"}
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {isLoading ? (
              <EventCardSkeleton count={3} imageHeight="450px" />
            ) : featuredConcerts.length > 0 ? (
              featuredConcerts.map((event) => (
                <EventCard
                  key={event.id}
                  event={event}
                  language={language}
                  accentColor="#C0CA33"
                  imageHeight="450px"
                  interestCount={interestCounts[event.id]}
                  showCity={false}
                  showVenue
                  showDate
                  showTime
                  metadataOrder={["venue", "date", "time"]}
                />
              ))
            ) : (
              <div className="col-span-3">
                <SectionEmptyState
                  icon={Music}
                  accentColor="#C0CA33"
                  message={
                    language === "sr"
                      ? "Trenutno nema sadržaja u ovoj sekciji."
                      : "There is currently no content in this section."
                  }
                />
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Concerts From Other Cities */}
      <section
        className="pt-16 pb-8 min-h-[320px]"
        style={{ background: "#FFFFFF" }}
      >
        <div className="w-[60vw] mx-auto">
          <h2
            className="mb-2.5 pb-2 lg:mb-4 lg:pb-3"
            style={{
              fontSize: "24px",
              fontWeight: 600,
              color: "#C0CA33",
              textShadow: "0 2px 4px rgba(0, 0, 0, 0.1)",
            }}
          >
            {language === "sr"
              ? "Koncerti iz drugih gradova"
              : "Concerts from other cities"}
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
            {isLoading ? (
              <EventCardSkeleton count={4} imageHeight="300px" />
            ) : otherCitiesConcerts.length > 0 ? (
              otherCitiesConcerts.map((event) => (
                <EventCard
                  key={event.id}
                  event={event}
                  language={language}
                  accentColor="#C0CA33"
                  imageHeight="300px"
                  interestCount={interestCounts[event.id]}
                  showCity
                  showVenue
                  showDate
                  showTime
                  metadataOrder={["city", "venue", "date", "time"]}
                />
              ))
            ) : (
              <div className="col-span-4">
                <SectionEmptyState
                  icon={Music}
                  accentColor="#C0CA33"
                  message={
                    language === "sr"
                      ? "Trenutno nema sadržaja u ovoj sekciji."
                      : "There is currently no content in this section."
                  }
                />
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
