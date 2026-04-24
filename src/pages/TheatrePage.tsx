import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router";
import { EventCard, EventCardSkeleton } from "../components/EventCard";
import { SectionEmptyState } from "../components/SectionEmptyState";
import { Drama } from "lucide-react";
import { useT } from "../hooks/useT";
import { useLanguage } from "../contexts/LanguageContext";
import { useSEO } from "../hooks/useSEO";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import { useLocation as useSelectedCity } from "../contexts/LocationContext";
import {
  DOC_TITLE_THEATRE,
  listingDocumentTitle,
} from "../utils/documentTitle";
import { getBreadcrumbSchema } from "../utils/structuredData";
import { SITE_URL } from "../config/siteConfig";
import * as eventService from "../utils/eventService";
import { Item } from "../utils/dataService";
import { getTopLevelPageCategory } from "../utils/eventPageCategory";
import { cityEquals } from "../utils/city";
const ogImage = "/zipa-city-guide-OG.png";
import theatreHeroImage from "../assets/theatre-hero.png";

function isApprovedTheatreEvent(e: Item): boolean {
  if (e.status !== "approved") return false;
  if (
    String(e.page_slug || "")
      .toLowerCase()
      .trim() === "theatre"
  )
    return true;
  return getTopLevelPageCategory(e) === "theatre";
}

function sortByStartAtAsc(events: Item[]): Item[] {
  const nextStart = (e: Item, now: Date): number => {
    const slots = eventService.getEventScheduleSlots(e);
    const next = slots.find((s) => new Date(s.start_at) >= now) ?? slots[0];
    if (next) return new Date(next.start_at).getTime();
    return e.start_at ? new Date(e.start_at).getTime() : 0;
  };
  const now = new Date();
  return [...events].sort((a, b) => nextStart(a, now) - nextStart(b, now));
}

function isNotEndedForOtherCitiesRepertoire(e: Item, now: Date): boolean {
  const slots = eventService.getEventScheduleSlots(e);
  if (slots.length > 0) {
    return slots.some((s) => new Date(s.end_at || s.start_at) >= now);
  }
  if (e.end_at) return new Date(e.end_at) >= now;
  if (e.start_at) return new Date(e.start_at) >= now;
  return false;
}

const USKORO_MAX_CARDS = 4;
const OTHER_CITIES_MAX_CARDS = 4;
const REPERTOIRE_MAX_CARDS = 5;

export function TheatrePage() {
  const { t } = useT();
  const { language } = useLanguage();
  const { selectedCity } = useSelectedCity();
  const [events, setEvents] = useState<Item[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [interestCounts, setInterestCounts] = useState<Record<string, number>>(
    {},
  );

  useEffect(() => {
    async function fetchTheatre() {
      setIsLoading(true);
      const [bySlug, byType] = await Promise.all([
        eventService.getEvents("all", undefined, undefined, "theatre"),
        eventService.getEvents("all", undefined, "theatre"),
      ]);
      const byId = new Map<string, Item>();
      for (const e of [...bySlug, ...byType]) {
        if (isApprovedTheatreEvent(e)) byId.set(e.id, e);
      }
      setEvents([...byId.values()]);
      setIsLoading(false);
    }
    fetchTheatre();
  }, []);

  const { repertoire, moreFromRepertoire, otherCities } = useMemo(() => {
    const now = new Date();
    const weekEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const nextStartAtOrNull = (e: Item): Date | null => {
      const slots = eventService.getEventScheduleSlots(e);
      const next = slots.find((s) => new Date(s.start_at) >= now);
      if (next) return new Date(next.start_at);
      return null;
    };

    const inCityNowShowing = events.filter((e) => {
      if (!isApprovedTheatreEvent(e)) return false;
      if (!cityEquals(e.city, selectedCity)) return false;
      const start = nextStartAtOrNull(e);
      if (!start) return false;
      return start >= now && start <= weekEnd;
    });
    const repertoire = sortByStartAtAsc(inCityNowShowing).slice(
      0,
      REPERTOIRE_MAX_CARDS,
    );

    const inCityComingSoon = events.filter((e) => {
      if (!isApprovedTheatreEvent(e)) return false;
      if (!cityEquals(e.city, selectedCity)) return false;
      const start = nextStartAtOrNull(e);
      if (!start) return false;
      return start > weekEnd;
    });
    const moreFromRepertoire = sortByStartAtAsc(inCityComingSoon).slice(
      0,
      USKORO_MAX_CARDS,
    );

    const otherPool = events.filter((e) => {
      if (!isApprovedTheatreEvent(e)) return false;
      if (!e.city || cityEquals(e.city, selectedCity)) return false;
      return isNotEndedForOtherCitiesRepertoire(e, now);
    });
    const otherCities = sortByStartAtAsc(otherPool).slice(
      0,
      OTHER_CITIES_MAX_CARDS,
    );

    return { repertoire, moreFromRepertoire, otherCities };
  }, [events, selectedCity]);

  useEffect(() => {
    const freeIds = [...repertoire, ...moreFromRepertoire, ...otherCities]
      .filter((e) => /^(free|besplatn|gratis)/i.test(e.price || ""))
      .map((e) => e.id);
    if (freeIds.length === 0) {
      setInterestCounts({});
      return;
    }
    eventService.batchGetInterestCounts(freeIds).then(setInterestCounts);
  }, [repertoire, moreFromRepertoire, otherCities]);

  useDocumentTitle(listingDocumentTitle(DOC_TITLE_THEATRE, selectedCity));

  useSEO({
    title: t("seoTheatreTitle"),
    description: t("seoTheatreDescription"),
    keywords: t("seoTheatreKeywords"),
    ogImage: ogImage,
    ogType: "website",
    canonical: SITE_URL + "/theatre",
    structuredData: {
      "@context": "https://schema.org",
      "@graph": [
        getBreadcrumbSchema([
          { name: "Home", url: SITE_URL + "/" },
          { name: "Pozorište", url: SITE_URL + "/theatre" },
        ]),
      ],
    },
  });

  return (
    <div className="min-h-screen" style={{ background: "#FFFFFF" }}>
      {/* HERO SECTION */}
      <section
        className="relative w-full min-h-[320px]"
        style={{ height: "420px", marginTop: 0 }}
      >
        <img
          src={theatreHeroImage}
          alt={t("theatre")}
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(rgba(142, 36, 170, 0.5), rgba(0, 0, 0, 0.7))",
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
            {t("theatrePageHero")}
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
              ? "Aktuelne predstave i scenski programi u gradu."
              : "Current plays and stage programs in the city."}
          </p>
        </div>
      </section>

      {/* REPERTOIRE */}
      <section
        className="py-16 overflow-hidden min-h-[320px]"
        style={{ background: "#FFFFFF" }}
      >
        <div className="w-[60vw] mx-auto">
          <h2
            className="text-left"
            style={{
              fontSize: "24px",
              fontWeight: 600,
              color: "#8E24AA",
              marginBottom: "24px",
              textShadow: "0 2px 4px rgba(0, 0, 0, 0.1)",
            }}
          >
            {language === "sr" ? "Scenski repertoar" : "Stage Repertoire"}
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {isLoading ? (
              <EventCardSkeleton count={5} imageHeight="300px" />
            ) : repertoire.length > 0 ? (
              repertoire.map((event) => (
                <EventCard
                  key={event.id}
                  event={event}
                  language={language}
                  accentColor="#8E24AA"
                  imageHeight="300px"
                  interestCount={interestCounts[event.id]}
                />
              ))
            ) : (
              <div className="col-span-5">
                <SectionEmptyState
                  icon={Drama}
                  accentColor="#8E24AA"
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
              to="/theatre/all"
              style={{
                display: "inline-block",
                background: "#8E24AA",
                color: "white",
                padding: "14px 32px",
                borderRadius: "8px",
                fontSize: "16px",
                fontWeight: 600,
                textDecoration: "none",
                transition: "all 0.3s",
              }}
              className="hover:opacity-90"
            >
              {language === "sr"
                ? "Pogledaj sav repertoar"
                : "View Full Repertoire"}
            </Link>
          </div>
        </div>
      </section>

      {/* UPCOMING EVENTS */}
      <section className="py-16 min-h-[320px]" style={{ background: "#F3E5F5" }}>
        <div className="w-[60vw] mx-auto">
          <h2
            style={{
              fontSize: "24px",
              fontWeight: 600,
              color: "#8E24AA",
              marginBottom: "24px",
              textShadow: "0 2px 4px rgba(0, 0, 0, 0.1)",
            }}
          >
            {language === "sr" ? "U najavi" : "Coming Soon"}
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {isLoading ? (
              <EventCardSkeleton count={4} imageHeight="400px" />
            ) : moreFromRepertoire.length > 0 ? (
              moreFromRepertoire.map((event) => (
                <EventCard
                  key={event.id}
                  event={event}
                  language={language}
                  accentColor="#8E24AA"
                  imageHeight="400px"
                  interestCount={interestCounts[event.id]}
                />
              ))
            ) : (
              <div className="col-span-4">
                <SectionEmptyState
                  icon={Drama}
                  accentColor="#8E24AA"
                  message={language === "sr" ? "Trenutno nema sadržaja u ovoj sekciji." : "There is currently no content in this section."}
                />
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Theatre From Other Cities */}
      <section className="pt-16 pb-8 min-h-[320px]" style={{ background: "#FFFFFF" }}>
        <div className="w-[60vw] mx-auto">
          <h2
            style={{
              fontSize: "24px",
              fontWeight: 600,
              color: "#8E24AA",
              marginBottom: "24px",
              textShadow: "0 2px 4px rgba(0, 0, 0, 0.1)",
            }}
          >
            {language === "sr"
              ? "Predstave u drugim gradovima"
              : "Performances from other cities"}
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {otherCities.length > 0 ? (
              otherCities.map((event) => (
                <EventCard
                  key={event.id}
                  event={event}
                  language={language}
                  accentColor="#8E24AA"
                  imageHeight="280px"
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
                  icon={Drama}
                  accentColor="#8E24AA"
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
