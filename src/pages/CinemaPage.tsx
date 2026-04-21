import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router";
import { Building2, Calendar, Clapperboard, Clock, MapPin } from "lucide-react";
import { EventCardSkeleton } from "../components/EventCard";
import { UnderConstruction } from "../components/UnderConstruction";
import { useT } from "../hooks/useT";
import { useLanguage } from "../contexts/LanguageContext";
import { useSEO } from "../hooks/useSEO";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import { useLocation as useSelectedCity } from "../contexts/LocationContext";
import { DOC_TITLE_CINEMA, listingDocumentTitle } from "../utils/documentTitle";
import { getBreadcrumbSchema } from "../utils/structuredData";
import { SITE_URL } from "../config/siteConfig";
import * as eventService from "../utils/eventService";
import { Item } from "../utils/dataService";
import ogImage from "../assets/5d3467711e1eb567830909e9073367edfa138777.png";
import cinemaHeroImage from "../assets/8fd8ca41ddd7aefadbb24990bbf75bf03885286c.png";

/**
 * Cinema-specific card with star rating display
 */
function CinemaCard({
  event,
  language,
  imageHeight = "300px",
  showEventCity = false,
}: {
  event: Item;
  language: string;
  imageHeight?: string;
  /** When true, event city is shown in the date/time meta line; venue line omits city fallback to avoid duplication. */
  showEventCity?: boolean;
}) {
  const lang = language === "en" ? "en" : "sr";
  const title = lang === "sr" ? event.title : event.title_en || event.title;
  const isFree = /^(free|besplatn|gratis)/i.test(event.price || "");
  const eventType = eventService.translateEventType(
    event.event_type || "",
    lang,
  );
  const dateLabel = event.start_at
    ? eventService.getRelativeDateLabel(event.start_at, lang)
    : "";
  const timeLabel = event.start_at
    ? eventService.formatEventTime(event.start_at, event.end_at, lang)
    : "";
  const venue =
    showEventCity && event.city
      ? event.venue_name || event.address || ""
      : event.venue_name || event.address || event.city || "";

  const otherCityVenueLine = (event.venue_name || event.address || "").trim();
  const showOtherCityMetaBlock =
    showEventCity &&
    Boolean(
      (event.city && String(event.city).trim()) ||
      otherCityVenueLine ||
      dateLabel ||
      timeLabel,
    );

  return (
    <Link
      to={`/events/${event.id}`}
      className="cursor-pointer hover:scale-[1.02] transition-all duration-300 block"
      style={{ textDecoration: "none" }}
    >
      <img
        src={
          event.image ||
          "https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=600"
        }
        alt={title}
        className="w-full object-cover rounded-md"
        style={{ height: imageHeight }}
      />
      <div className="p-4">
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          {eventType && (
            <span
              className="text-xs font-medium px-2 py-1 rounded"
              style={{ background: "#F3F4F6", color: "#00897B" }}
            >
              {eventType}
            </span>
          )}
          {isFree && (
            <span
              className="text-xs font-medium px-2 py-1 rounded"
              style={{ background: "#F3F4F6", color: "#6B7280" }}
            >
              {language === "sr" ? "Besplatan ulaz" : "Free Entry"}
            </span>
          )}
        </div>
        <h3
          className="text-base font-semibold mb-2"
          style={{ color: "#1a1a1a" }}
        >
          {title}
        </h3>
        {showEventCity ? (
          showOtherCityMetaBlock && (
            <div className="flex flex-col gap-1">
              {event.city && String(event.city).trim() ? (
                <div className="flex items-center gap-2">
                  <Building2 size={14} style={{ color: "#6B7280" }} />
                  <span className="text-sm" style={{ color: "#6B7280" }}>
                    {event.city}
                  </span>
                </div>
              ) : null}
              {otherCityVenueLine ? (
                <div className="flex items-center gap-2">
                  <MapPin size={14} style={{ color: "#6B7280" }} />
                  <span className="text-sm" style={{ color: "#6B7280" }}>
                    {otherCityVenueLine}
                  </span>
                </div>
              ) : null}
              {dateLabel ? (
                <div className="flex items-center gap-2">
                  <Calendar size={14} style={{ color: "#6B7280" }} />
                  <span className="text-sm" style={{ color: "#6B7280" }}>
                    {dateLabel}
                  </span>
                </div>
              ) : null}
              {timeLabel ? (
                <div className="flex items-center gap-2">
                  <Clock size={14} style={{ color: "#6B7280" }} />
                  <span className="text-sm" style={{ color: "#6B7280" }}>
                    {timeLabel}
                  </span>
                </div>
              ) : null}
            </div>
          )
        ) : (
          <>
            {venue || dateLabel || timeLabel ? (
              <div className="flex flex-col gap-1">
                {venue ? (
                  <div className="flex items-center gap-2">
                    <MapPin size={14} style={{ color: "#6B7280" }} />
                    <span className="text-sm" style={{ color: "#6B7280" }}>
                      {venue}
                    </span>
                  </div>
                ) : null}
                {dateLabel ? (
                  <div className="flex items-center gap-2">
                    <Calendar size={14} style={{ color: "#6B7280" }} />
                    <span className="text-sm" style={{ color: "#6B7280" }}>
                      {dateLabel}
                    </span>
                  </div>
                ) : null}
                {timeLabel ? (
                  <div className="flex items-center gap-2">
                    <Clock size={14} style={{ color: "#6B7280" }} />
                    <span className="text-sm" style={{ color: "#6B7280" }}>
                      {timeLabel}
                    </span>
                  </div>
                ) : null}
              </div>
            ) : null}
          </>
        )}
      </div>
    </Link>
  );
}

function normalizedPageSlug(e: Item): string {
  return String(e.page_slug || "")
    .toLowerCase()
    .trim();
}

function isApprovedCinemaPageEvent(e: Item): boolean {
  return e.status === "approved" && normalizedPageSlug(e) === "cinema";
}

function sortByStartAtAsc(events: Item[]): Item[] {
  return [...events].sort(
    (a, b) =>
      (a.start_at ? new Date(a.start_at).getTime() : 0) -
      (b.start_at ? new Date(b.start_at).getTime() : 0),
  );
}

/** Other-cities section: not ended — end_at >= now if end_at exists, else start_at >= now */
function isNotEndedForOtherCitiesRepertoire(e: Item, now: Date): boolean {
  if (e.end_at) return new Date(e.end_at) >= now;
  if (e.start_at) return new Date(e.start_at) >= now;
  return false;
}

const USKORO_MAX_CARDS = 8;
const OTHER_CITIES_MAX_CARDS = 4;

export function CinemaPage() {
  const { t } = useT();
  const { language } = useLanguage();
  const { selectedCity } = useSelectedCity();
  const [cinemaEvents, setCinemaEvents] = useState<Item[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchCinema() {
      setIsLoading(true);
      const [bySlug, byType] = await Promise.all([
        eventService.getEvents("all", undefined, undefined, "cinema"),
        eventService.getEvents("all", undefined, "cinema"),
      ]);
      const byId = new Map<string, Item>();
      for (const e of [...bySlug, ...byType]) {
        if (isApprovedCinemaPageEvent(e)) byId.set(e.id, e);
      }
      setCinemaEvents([...byId.values()]);
      setIsLoading(false);
    }
    fetchCinema();
  }, []);

  const { nowShowing, moreFromRepertoire, otherCities } = useMemo(() => {
    const now = new Date();
    const weekEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const repertoire = cinemaEvents.filter((e) => {
      if (!isApprovedCinemaPageEvent(e)) return false;
      if (e.city !== selectedCity) return false;
      if (!e.start_at) return false;
      const start = new Date(e.start_at);
      return start >= now && start <= weekEnd;
    });
    const nowShowing = sortByStartAtAsc(repertoire).slice(0, 5);

    const comingSoon = cinemaEvents.filter((e) => {
      if (!isApprovedCinemaPageEvent(e)) return false;
      if (e.city !== selectedCity) return false;
      if (!e.start_at) return false;
      const start = new Date(e.start_at);
      return start > weekEnd;
    });
    const moreFromRepertoire = sortByStartAtAsc(comingSoon).slice(
      0,
      USKORO_MAX_CARDS,
    );

    const otherPool = cinemaEvents.filter((e) => {
      if (!isApprovedCinemaPageEvent(e)) return false;
      if (!e.city || e.city === selectedCity) return false;
      return isNotEndedForOtherCitiesRepertoire(e, now);
    });
    const otherCities = sortByStartAtAsc(otherPool).slice(
      0,
      OTHER_CITIES_MAX_CARDS,
    );

    return { nowShowing, moreFromRepertoire, otherCities };
  }, [cinemaEvents, selectedCity]);

  useDocumentTitle(listingDocumentTitle(DOC_TITLE_CINEMA, selectedCity));

  useSEO({
    title: t("seoCinemaTitle"),
    description: t("seoCinemaDescription"),
    keywords: t("seoCinemaKeywords"),
    ogImage: ogImage,
    ogType: "website",
    canonical: SITE_URL + "/cinema",
    structuredData: {
      "@context": "https://schema.org",
      "@graph": [
        getBreadcrumbSchema([
          { name: "Home", url: SITE_URL + "/" },
          { name: "Bioskop", url: SITE_URL + "/cinema" },
        ]),
      ],
    },
  });

  return (
    <div className="min-h-screen" style={{ background: "#FFFFFF" }}>
      {/* HERO SECTION */}
      <section
        className="relative w-full"
        style={{ height: "420px", marginTop: 0 }}
      >
        <img
          src={cinemaHeroImage}
          alt={t("cinema")}
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(rgba(0, 137, 123, 0.5), rgba(0, 0, 0, 0.7))",
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
            {t("cinemaPageHero")}
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
              ? "Novi filmovi, premijere i omiljeni naslovi na velikom platnu."
              : "New movies, premieres and favorite titles on the big screen."}
          </p>
        </div>
      </section>

      {/* NOW SHOWING */}
      <section
        className="py-16 overflow-hidden"
        style={{ background: "#FFFFFF" }}
      >
        <div className="w-[60vw] mx-auto">
          <h2
            className="text-left"
            style={{
              fontSize: "24px",
              fontWeight: 600,
              color: "#00897B",
              marginBottom: "24px",
            }}
          >
            {language === "sr" ? "Repertoar" : "Now Showing"}
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {isLoading ? (
              <EventCardSkeleton count={5} imageHeight="300px" />
            ) : nowShowing.length > 0 ? (
              nowShowing.map((event) => (
                <CinemaCard
                  key={event.id}
                  event={event}
                  language={language}
                  imageHeight="300px"
                />
              ))
            ) : (
              <div className="col-span-5">
                <UnderConstruction
                  language={language}
                  accentColor="#00897B"
                  icon={Clapperboard}
                />
              </div>
            )}
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "center",
              marginTop: "40px",
            }}
          >
            <Link
              to="/cinema/all"
              style={{
                display: "inline-block",
                background: "#00897B",
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
              {language === "sr" ? "Pogledaj sav repertoar" : "View All Movies"}
            </Link>
          </div>
        </div>
      </section>

      {/* UPCOMING EVENTS */}
      <section className="py-16" style={{ background: "#E0F2F1" }}>
        <div className="w-[60vw] mx-auto">
          <h2
            style={{
              fontSize: "24px",
              fontWeight: 600,
              color: "#00897B",
              marginBottom: "24px",
            }}
          >
            {language === "sr" ? "Uskoro u bioskopu" : "Coming Soon"}
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {isLoading ? (
              <EventCardSkeleton count={4} imageHeight="400px" />
            ) : moreFromRepertoire.length > 0 ? (
              moreFromRepertoire.map((event) => (
                <CinemaCard
                  key={event.id}
                  event={event}
                  language={language}
                  imageHeight="400px"
                />
              ))
            ) : (
              <div className="col-span-4">
                <UnderConstruction
                  language={language}
                  accentColor="#00897B"
                  icon={Clapperboard}
                />
              </div>
            )}
          </div>
        </div>
      </section>

      {/* OTHER CITIES REPERTOIRE */}
      <section className="py-16" style={{ background: "#FFFFFF" }}>
        <div className="w-[60vw] mx-auto">
          <h2
            className="text-left"
            style={{
              fontSize: "24px",
              fontWeight: 600,
              color: "#00897B",
              marginBottom: "24px",
            }}
          >
            {language === "sr"
              ? "Bioskopski repertoar iz drugih gradova"
              : "Cinema repertoire from other cities"}
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {otherCities.length > 0 ? (
              otherCities.map((event) => (
                <CinemaCard
                  key={event.id}
                  event={event}
                  language={language}
                  imageHeight="280px"
                  showEventCity
                />
              ))
            ) : (
              <div className="col-span-4">
                <UnderConstruction
                  language={language}
                  accentColor="#00897B"
                  icon={Clapperboard}
                />
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
