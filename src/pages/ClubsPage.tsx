import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router";
import { MapPinned, Clock, MapPin, Disc3 } from "lucide-react";
import { useT } from "../hooks/useT";
import { useLocation } from "../contexts/LocationContext";
import { useSEO } from "../hooks/useSEO";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import { DOC_TITLE_CLUBS, listingDocumentTitle } from "../utils/documentTitle";
import { SectionEmptyState } from "../components/SectionEmptyState";
import { getBreadcrumbSchema } from "../utils/structuredData";
import { SITE_URL } from "../config/siteConfig";
import { getVenues } from "../utils/dataService";
import type { Item } from "../utils/dataService";
import * as eventService from "../utils/eventService";
const ogImage = "/zipa-city-guide-OG.png";
import clubsHeroImage from "../assets/clubs-hero.png";
import {
  CLUBS_CATEGORY_THEME,
  CLUBS_HERO_OVERLAY_GRADIENT,
} from "../utils/categoryThemes";
import { normalizeCityForCompare, getTopCities } from "../utils/city";
import { EventCardSkeleton } from "../components/EventCard";
import { RevealOnScrollArticle } from "../components/RevealOnScrollArticle";
import { VenueBadgeRow } from "../components/VenueBadgeRow";
import { splitOpeningHoursDisplaySegments } from "../utils/openingHoursDisplay";
import type { TranslationKey } from "../utils/translations";
import {
  LISTING_PAGE_CONTENT_SECTION_CLASS,
  LISTING_PAGE_HERO_SECTION_CLASS,
} from "../utils/listingPageLayout";
import { venueDetailPath } from "../utils/venueRouting";

const MAIN_MAX_CARDS = 6;
const FEATURED_MAX_CARDS = 4;
const OTHER_CITIES_MAX_CARDS = 4;

/** Jedna vrijednost po gridu: skeleton i ClubsCard moraju ostati usklađeni. */
const CLUBS_MAIN_CARD_IMAGE_HEIGHT = "250px";
const CLUBS_FEATURED_CARD_IMAGE_HEIGHT = "350px";
const CLUBS_OTHER_CITIES_CARD_IMAGE_HEIGHT = "200px";

function isFeaturedVenue(venue: Item): boolean {
  const featured = venue as Item & {
    is_featured?: boolean;
    featured?: boolean;
    starred?: boolean;
  };
  return Boolean(featured.is_featured || featured.featured || featured.starred);
}

function nextStartAtOrNull(venue: Item, now: Date): Date | null {
  const slots = eventService.getEventScheduleSlots(venue);
  const nextSlot = slots.find((slot) => new Date(slot.start_at) >= now);
  if (nextSlot) return new Date(nextSlot.start_at);

  const candidates = [venue.start_at, venue.date]
    .filter(Boolean)
    .map((raw) => new Date(String(raw)))
    .filter((value) => !Number.isNaN(value.getTime()) && value >= now);

  return candidates.length > 0 ? candidates[0]! : null;
}

function sortByNextDateAsc(venues: Item[], now: Date): Item[] {
  return [...venues].sort((a, b) => {
    const aTime =
      nextStartAtOrNull(a, now)?.getTime() ?? Number.MAX_SAFE_INTEGER;
    const bTime =
      nextStartAtOrNull(b, now)?.getTime() ?? Number.MAX_SAFE_INTEGER;
    if (aTime !== bTime) return aTime - bTime;
    return (
      new Date(b.created_at || 0).getTime() -
      new Date(a.created_at || 0).getTime()
    );
  });
}

function ClubsCard({
  club,
  language,
  imageHeight = CLUBS_FEATURED_CARD_IMAGE_HEIGHT,
  variant,
  t,
}: {
  club: Item;
  language: string;
  imageHeight?: string;
  /** `local`: kao FoodAndDrink kartice (oznake, naziv, adresa, sati). `otherCities`: + red za grad. */
  variant: "local" | "otherCities";
  t: (key: TranslationKey) => string;
}) {
  const locale: "sr" | "en" = language === "en" ? "en" : "sr";
  const title = language === "sr" ? club.title : club.title_en || club.title;

  const eventCity = String(club.city || "").trim();
  const addressPhysical = String(club.address || "").trim();
  const venueOrLocation = String(
    club.venue_name || (club as Item & { location?: string }).location || "",
  ).trim();

  /** Lokalno: kao Food — adresa, pa naziv mjesta / lokacija, pa tek onda grad (bez duplog prikaza grada u "drugi gradovi"). */
  const addressLineLocal = addressPhysical || venueOrLocation || eventCity;
  const addressLineOther =
    addressPhysical ||
    (venueOrLocation && venueOrLocation !== eventCity ? venueOrLocation : "");

  const hoursRaw =
    locale === "en" && club.opening_hours_en
      ? club.opening_hours_en
      : club.opening_hours || "";
  const hourSegments = hoursRaw
    ? splitOpeningHoursDisplaySegments(hoursRaw)
    : [];
  const hoursFirst = hourSegments[0] || "";
  const hoursExtraCount = hourSegments.length > 1 ? hourSegments.length - 1 : 0;

  return (
    <Link
      to={venueDetailPath(club)}
      className="block h-full no-underline"
      style={{ textDecoration: "none" }}
    >
      <div className="cursor-pointer hover:scale-[1.02] transition-all duration-300 h-full">
        <img
          src={
            club.image ||
            "https://images.unsplash.com/photo-1540039155733-5bb30b53aa14?w=600"
          }
          alt={title}
          className="w-full object-cover rounded-md"
          style={{ height: imageHeight }}
        />
        <div className="p-4">
          <VenueBadgeRow
            cuisine={club.cuisine}
            cuisine_en={club.cuisine_en}
            tags={club.tags}
            language={locale}
            t={t}
            cuisineOnly
            listingFallback={t("clubs")}
            pageSlug="clubs"
          />
          <h3
            className="text-base font-semibold mb-2"
            style={{ color: "#1a1a1a" }}
          >
            {title}
          </h3>

          {variant === "otherCities" && eventCity ? (
            <div className="flex items-center gap-2 mb-1">
              <MapPinned
                size={14}
                className="shrink-0"
                style={{ color: "#6B7280" }}
              />
              <span className="text-sm" style={{ color: "#6B7280" }}>
                {eventCity}
              </span>
            </div>
          ) : null}

          {(variant === "local" ? addressLineLocal : addressLineOther) ? (
            <div className="flex items-center gap-2 mb-1">
              {variant === "local" ? (
                addressPhysical || venueOrLocation ? (
                  <MapPin
                    size={14}
                    className="shrink-0"
                    style={{ color: "#6B7280" }}
                  />
                ) : (
                  <MapPinned
                    size={14}
                    className="shrink-0"
                    style={{ color: "#6B7280" }}
                  />
                )
              ) : (
                <MapPin
                  size={14}
                  className="shrink-0"
                  style={{ color: "#6B7280" }}
                />
              )}
              <span className="text-sm" style={{ color: "#6B7280" }}>
                {variant === "local" ? addressLineLocal : addressLineOther}
              </span>
            </div>
          ) : null}

          {hoursFirst ? (
            <div className="flex items-start gap-2">
              <Clock
                size={14}
                className="shrink-0 mt-0.5"
                style={{ color: "#6B7280" }}
              />
              <span className="text-sm min-w-0" style={{ color: "#6B7280" }}>
                {hoursFirst}
                {hoursExtraCount > 0 ? (
                  <span className="whitespace-nowrap">
                    {" "}
                    (+{hoursExtraCount})
                  </span>
                ) : null}
              </span>
            </div>
          ) : null}
        </div>
      </div>
    </Link>
  );
}

export function ClubsPage() {
  const { t, language } = useT();
  const { selectedCity } = useLocation();
  const [clubs, setClubs] = useState<Item[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function fetchClubs() {
      setIsLoading(true);
      const fetchedClubs = await getVenues("clubs");
      if (cancelled) return;
      setClubs(fetchedClubs);
      setIsLoading(false);
    }
    fetchClubs();
    return () => {
      cancelled = true;
    };
  }, [selectedCity]);

  const { mainClubs, featuredClubs, otherCitiesClubs } = useMemo(() => {
    const now = new Date();
    const selectedCityKey = normalizeCityForCompare(selectedCity);
    const approved = clubs.filter((club) => club.status === "approved");

    const localClubs = approved.filter((club) => {
      const cityKey = normalizeCityForCompare(club.city);
      return !cityKey || cityKey === selectedCityKey;
    });

    const orderedLocal = sortByNextDateAsc(localClubs, now);
    const mainClubs = orderedLocal.slice(0, MAIN_MAX_CARDS);

    const starred = orderedLocal.filter((club) => isFeaturedVenue(club));
    const featuredSelected = starred.slice(0, FEATURED_MAX_CARDS);
    const selectedIds = new Set(featuredSelected.map((club) => club.id));
    const featuredFallback = orderedLocal.filter(
      (club) => !selectedIds.has(club.id),
    );
    const featuredClubs = [...featuredSelected].concat(
      featuredFallback.slice(
        0,
        Math.max(FEATURED_MAX_CARDS - featuredSelected.length, 0),
      ),
    );

    const outsideSelectedCity = approved.filter((club) => {
      const cityKey = normalizeCityForCompare(club.city);
      return Boolean(cityKey) && cityKey !== selectedCityKey;
    });
    const topCities = getTopCities(outsideSelectedCity, OTHER_CITIES_MAX_CARDS);
    const topCityKeys = new Set(topCities.map((city) => city.key));
    const byCity = new Map<string, Item[]>();

    for (const club of sortByNextDateAsc(outsideSelectedCity, now)) {
      const cityKey = normalizeCityForCompare(club.city);
      if (!cityKey || !topCityKeys.has(cityKey)) continue;
      const bucket = byCity.get(cityKey) ?? [];
      bucket.push(club);
      byCity.set(cityKey, bucket);
    }

    const otherCitiesClubs = topCities
      .map((city) => byCity.get(city.key)?.[0] ?? null)
      .filter((club): club is Item => Boolean(club))
      .slice(0, OTHER_CITIES_MAX_CARDS);

    return { mainClubs, featuredClubs, otherCitiesClubs };
  }, [clubs, selectedCity]);

  useDocumentTitle(listingDocumentTitle(DOC_TITLE_CLUBS, selectedCity));

  // SEO optimization for clubs page
  useSEO({
    title: t("seoClubsTitle"),
    description: t("seoClubsDescription"),
    keywords: t("seoClubsKeywords"),
    ogImage: ogImage,
    ogType: "website",
    canonical: SITE_URL + "/clubs",
    structuredData: {
      "@context": "https://schema.org",
      "@graph": [
        getBreadcrumbSchema([
          { name: "Home", url: SITE_URL + "/" },
          {
            name: "Klubovi",
            url: SITE_URL + "/clubs",
          },
        ]),
        {
          "@type": "ItemList",
          name: "Klubovi u Banjoj Luci",
          description: "Lista najboljih klubova u Banjoj Luci",
          numberOfItems: 40,
        },
      ],
    },
  });

  return (
    <div className="min-h-screen" style={{ background: "#FFFFFF" }}>
      {/* HERO SECTION - Full Width */}
      <section
        className={LISTING_PAGE_HERO_SECTION_CLASS}
        style={{
          height: "420px",
          background: `${CLUBS_HERO_OVERLAY_GRADIENT}, url('${clubsHeroImage}') center/cover`,
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
            {t("nightRhythm")}
          </h1>
          <p
            className="text-center"
            style={{
              fontSize: "18px",
              color: "#FFFFFF",
              textShadow:
                "0 0 15px rgba(255,255,255,0.7), 0 0 25px rgba(255,255,255,0.5), 2px 2px 8px rgba(0,0,0,0.9)",
              maxWidth: "700px",
              margin: "0 auto",
            }}
          >
            {t("bestClubsParties")}
          </p>
        </div>
      </section>

      {/* CLUBS — isti layout wrapper i skeleton kao EventsPage */}
      <section
        className={LISTING_PAGE_CONTENT_SECTION_CLASS}
        style={{ background: "#FFFFFF" }}
      >
        <div className="w-[60vw] mx-auto">
          <h2
            style={{
              fontSize: "24px",
              fontWeight: 600,
              color: CLUBS_CATEGORY_THEME.accentColor,
              marginBottom: "24px",
              textShadow: "0 2px 4px rgba(0, 0, 0, 0.1)",
            }}
          >
            {language === "sr" ? "Klubovi" : "Clubs"}
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {isLoading ? (
              <EventCardSkeleton
                count={MAIN_MAX_CARDS}
                imageHeight={CLUBS_MAIN_CARD_IMAGE_HEIGHT}
              />
            ) : mainClubs.length === 0 ? (
              <div className="col-span-3">
                <SectionEmptyState
                  icon={Disc3}
                  accentColor={CLUBS_CATEGORY_THEME.accentColor}
                  message={
                    language === "sr"
                      ? "Trenutno nema sadržaja u ovoj sekciji."
                      : "There is currently no content in this section."
                  }
                />
              </div>
            ) : (
              mainClubs.map((club) => (
                <RevealOnScrollArticle key={club.id}>
                  <ClubsCard
                    club={club}
                    language={language}
                    imageHeight={CLUBS_MAIN_CARD_IMAGE_HEIGHT}
                    variant="local"
                    t={t}
                  />
                </RevealOnScrollArticle>
              ))
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
              to="/clubs/all"
              style={{
                display: "inline-block",
                background: CLUBS_CATEGORY_THEME.ctaBackground,
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
              {t("viewAllClubs")}
            </Link>
          </div>
        </div>
      </section>

      {/* FEATURED CLUBS */}
      <section
        className={LISTING_PAGE_CONTENT_SECTION_CLASS}
        style={{ background: "#FCE4EC" }}
      >
        <div className="w-[60vw] mx-auto">
          <h2
            style={{
              fontSize: "24px",
              fontWeight: 600,
              color: CLUBS_CATEGORY_THEME.accentColor,
              marginBottom: "24px",
              textShadow: "0 2px 4px rgba(0, 0, 0, 0.1)",
            }}
          >
            {t("featuredClubs")}
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {isLoading ? (
              <EventCardSkeleton
                count={FEATURED_MAX_CARDS}
                imageHeight={CLUBS_FEATURED_CARD_IMAGE_HEIGHT}
              />
            ) : featuredClubs.length > 0 ? (
              featuredClubs.map((club) => (
                <RevealOnScrollArticle key={club.id}>
                  <ClubsCard
                    club={club}
                    language={language}
                    imageHeight={CLUBS_FEATURED_CARD_IMAGE_HEIGHT}
                    variant="local"
                    t={t}
                  />
                </RevealOnScrollArticle>
              ))
            ) : (
              <div className="col-span-full sm:col-span-2 lg:col-span-4">
                <SectionEmptyState
                  icon={Disc3}
                  accentColor={CLUBS_CATEGORY_THEME.accentColor}
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

      {/* CLUBS FROM OTHER CITIES */}
      <section
        className={LISTING_PAGE_CONTENT_SECTION_CLASS}
        style={{ background: "#FFFFFF" }}
      >
        <div className="w-[60vw] mx-auto">
          <h2
            style={{
              fontSize: "24px",
              fontWeight: 600,
              color: CLUBS_CATEGORY_THEME.accentColor,
              marginBottom: "24px",
              textShadow: "0 2px 4px rgba(0, 0, 0, 0.1)",
            }}
          >
            {language === "sr"
              ? "Klubovi iz drugih gradova"
              : "Clubs from other cities"}
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {isLoading ? (
              <EventCardSkeleton
                count={OTHER_CITIES_MAX_CARDS}
                imageHeight={CLUBS_OTHER_CITIES_CARD_IMAGE_HEIGHT}
              />
            ) : otherCitiesClubs.length > 0 ? (
              otherCitiesClubs.map((club) => (
                <RevealOnScrollArticle key={club.id}>
                  <ClubsCard
                    club={club}
                    language={language}
                    imageHeight={CLUBS_OTHER_CITIES_CARD_IMAGE_HEIGHT}
                    variant="otherCities"
                    t={t}
                  />
                </RevealOnScrollArticle>
              ))
            ) : (
              <div className="col-span-4">
                <SectionEmptyState
                  icon={Disc3}
                  accentColor={CLUBS_CATEGORY_THEME.accentColor}
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
