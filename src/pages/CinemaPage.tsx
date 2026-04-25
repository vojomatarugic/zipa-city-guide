import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router";
import { MapPinned, CalendarDays, Clapperboard, Clock, MapPin } from "lucide-react";
import { EventCardSkeleton } from "../components/EventCard";
import { SectionEmptyState } from "../components/SectionEmptyState";
import { Badge } from "../components/ui/badge";
import { useT } from "../hooks/useT";
import { useLanguage } from "../contexts/LanguageContext";
import { useSEO } from "../hooks/useSEO";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import { useLocation as useSelectedCity } from "../contexts/LocationContext";
import { DOC_TITLE_CINEMA, listingDocumentTitle } from "../utils/documentTitle";
import { getBreadcrumbSchema } from "../utils/structuredData";
import { SITE_URL } from "../config/siteConfig";
import { getLocalizedEventCategory } from "../config/eventCategories";
import {
  eventDetailPath,
  getTopLevelPageCategory,
} from "../utils/eventPageCategory";
import {
  getBadgeTextColorForPageSlug,
  LISTING_BADGE_SURFACE_CLASS,
} from "../utils/categoryThemes";
import { cityEquals } from "../utils/city";
import * as eventService from "../utils/eventService";
import { Item } from "../utils/dataService";
const ogImage = "/zipa-city-guide-OG.png";
import cinemaHeroImage from "../assets/cinema-hero.png";
import { RevealOnScrollArticle } from "../components/RevealOnScrollArticle";

const CINEMA_NOW_SHOWING_CARD_IMAGE_HEIGHT = "300px";
const CINEMA_COMING_SOON_CARD_IMAGE_HEIGHT = "400px";
const CINEMA_OTHER_CITIES_CARD_IMAGE_HEIGHT = "280px";

/**
 * Cinema-specific card with star rating display
 */
function CinemaCard({
  event,
  language,
  imageHeight = CINEMA_NOW_SHOWING_CARD_IMAGE_HEIGHT,
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
  const now = new Date();
  const slots = eventService.getEventScheduleSlots(event);
  const nextSlot =
    slots.find((s) => new Date(s.start_at) >= now) ?? slots[0] ?? null;
  const dateLabel = nextSlot
    ? eventService.getRelativeDateLabel(nextSlot.start_at, lang)
    : event.start_at
      ? eventService.getRelativeDateLabel(event.start_at, lang)
      : "";
  const timeLabel = nextSlot
    ? eventService.formatEventTime(nextSlot.start_at, nextSlot.end_at, lang)
    : event.start_at
      ? eventService.formatEventTime(event.start_at, event.end_at, lang)
      : "";
  const venue =
    showEventCity && event.city
      ? event.venue_name || event.address || ""
      : event.venue_name || event.address || event.city || "";
  const categoryLabel = event.category
    ? getLocalizedEventCategory(event.category, language)
    : "";
  const badgeTextColor = getBadgeTextColorForPageSlug(
    getTopLevelPageCategory(event),
  );

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
      to={eventDetailPath(event)}
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
          {event.category && (
            <Badge
              className={LISTING_BADGE_SURFACE_CLASS}
              style={{ color: badgeTextColor }}
            >
              {categoryLabel}
            </Badge>
          )}
          {isFree && (
            <Badge
              className={LISTING_BADGE_SURFACE_CLASS}
              style={{ color: badgeTextColor }}
            >
              {language === "sr" ? "Besplatan ulaz" : "Free Entry"}
            </Badge>
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
                  <MapPinned size={14} style={{ color: "#6B7280" }} />
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
                  <CalendarDays size={14} style={{ color: "#6B7280" }} />
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
                    {String(event.venue_name || "").trim() ||
                    String(event.address || "").trim() ? (
                      <MapPin size={14} style={{ color: "#6B7280" }} />
                    ) : (
                      <MapPinned size={14} style={{ color: "#6B7280" }} />
                    )}
                    <span className="text-sm" style={{ color: "#6B7280" }}>
                      {venue}
                    </span>
                  </div>
                ) : null}
                {dateLabel ? (
                  <div className="flex items-center gap-2">
                    <CalendarDays size={14} style={{ color: "#6B7280" }} />
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
  if (e.status !== "approved") return false;
  if (normalizedPageSlug(e) === "cinema") return true;
  return getTopLevelPageCategory(e) === "cinema";
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

/** Other-cities section: not ended — at least one slot is active/upcoming. */
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
    const nextStartAtOrNull = (e: Item): Date | null => {
      const slots = eventService.getEventScheduleSlots(e);
      const next = slots.find((s) => new Date(s.start_at) >= now);
      if (next) return new Date(next.start_at);
      return null;
    };

    const repertoire = cinemaEvents.filter((e) => {
      if (!isApprovedCinemaPageEvent(e)) return false;
      if (!cityEquals(e.city, selectedCity)) return false;
      const start = nextStartAtOrNull(e);
      if (!start) return false;
      return start >= now && start <= weekEnd;
    });
    const nowShowing = sortByStartAtAsc(repertoire).slice(
      0,
      REPERTOIRE_MAX_CARDS,
    );

    const comingSoon = cinemaEvents.filter((e) => {
      if (!isApprovedCinemaPageEvent(e)) return false;
      if (!cityEquals(e.city, selectedCity)) return false;
      const start = nextStartAtOrNull(e);
      if (!start) return false;
      return start > weekEnd;
    });
    const moreFromRepertoire = sortByStartAtAsc(comingSoon).slice(
      0,
      USKORO_MAX_CARDS,
    );

    const otherPool = cinemaEvents.filter((e) => {
      if (!isApprovedCinemaPageEvent(e)) return false;
      if (!e.city || cityEquals(e.city, selectedCity)) return false;
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
        className="relative w-full min-h-[320px]"
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
        className="py-16 overflow-hidden min-h-[320px]"
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
              <EventCardSkeleton
                count={5}
                imageHeight={CINEMA_NOW_SHOWING_CARD_IMAGE_HEIGHT}
              />
            ) : nowShowing.length > 0 ? (
              nowShowing.map((event) => (
                <RevealOnScrollArticle key={event.id}>
                  <CinemaCard
                    event={event}
                    language={language}
                    imageHeight={CINEMA_NOW_SHOWING_CARD_IMAGE_HEIGHT}
                  />
                </RevealOnScrollArticle>
              ))
            ) : (
              <div className="col-span-5">
                <SectionEmptyState
                  icon={Clapperboard}
                  accentColor="#00897B"
                  message={language === "sr" ? "Trenutno nema sadržaja u ovoj sekciji." : "There is currently no content in this section."}
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
      <section className="py-16 min-h-[320px]" style={{ background: "#E0F2F1" }}>
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
              <EventCardSkeleton
                count={4}
                imageHeight={CINEMA_COMING_SOON_CARD_IMAGE_HEIGHT}
              />
            ) : moreFromRepertoire.length > 0 ? (
              moreFromRepertoire.map((event) => (
                <RevealOnScrollArticle key={event.id}>
                  <CinemaCard
                    event={event}
                    language={language}
                    imageHeight={CINEMA_COMING_SOON_CARD_IMAGE_HEIGHT}
                  />
                </RevealOnScrollArticle>
              ))
            ) : (
              <div className="col-span-4">
                <SectionEmptyState
                  icon={Clapperboard}
                  accentColor="#00897B"
                  message={language === "sr" ? "Trenutno nema sadržaja u ovoj sekciji." : "There is currently no content in this section."}
                />
              </div>
            )}
          </div>
        </div>
      </section>

      {/* OTHER CITIES REPERTOIRE */}
      <section className="py-16 min-h-[320px]" style={{ background: "#FFFFFF" }}>
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
                <RevealOnScrollArticle key={event.id}>
                  <CinemaCard
                    event={event}
                    language={language}
                    imageHeight={CINEMA_OTHER_CITIES_CARD_IMAGE_HEIGHT}
                    showEventCity
                  />
                </RevealOnScrollArticle>
              ))
            ) : (
              <div className="col-span-4">
                <SectionEmptyState
                  icon={Clapperboard}
                  accentColor="#00897B"
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
