import { useState, useEffect, useMemo, useRef } from "react";
import { flushSync } from "react-dom";
import {
  MapPin,
  MapPinned,
  ChevronDown,
  X,
  CalendarDays,
  Clock,
  Heart,
} from "lucide-react";
import { useNavigate, Link } from "react-router";
import { useSEO } from "../hooks/useSEO";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import { homeDocumentTitle } from "../utils/documentTitle";
import { useT } from "../hooks/useT";
import { useLocation } from "../contexts/LocationContext";
import * as eventService from "../utils/eventService";
import {
  eventDetailPath,
  getTopLevelPageCategory,
} from "../utils/eventPageCategory";
import { venueDetailPath } from "../utils/venueRouting";
import { getTopCities, normalizeCityForCompare } from "../utils/city";
import { getFeaturedVenues, getVenues, Item } from "../utils/dataService";
import {
  getWebSiteSchema,
  getTouristDestinationSchema,
  getBreadcrumbSchema,
} from "../utils/structuredData";
import { SITE_URL } from "../config/siteConfig";
import { BannerAd, useBannerExists } from "../components/BannerAd";
import { SquareBannersGrid } from "../components/SquareBannersGrid";
import { VenueOpeningHoursRow } from "../components/VenueOpeningHoursRow";
import { SocialProofGallery } from "../components/SocialProofGallery";
import { RevealOnScrollArticle } from "../components/RevealOnScrollArticle";
import {
  GRADIENTS,
  BACKGROUNDS,
  CATEGORY_COLORS,
  TEXT,
  UTILITY,
  getGradientTextStyle,
} from "../utils/colors";
import { translations } from "../utils/translations";
import { formatDate as formatAppDate } from "../utils/dateFormat";
import kastelHeroImage from "../assets/kastel.png";
const ogImage = "/zipa-city-guide-OG.png";
import cityModalBg from "../assets/location-modal-bg.png";
import newCityModalBg from "../assets/location-modal-bg.png";
import heroBackgroundImage from "../assets/hero-home-page.png";
import banjaLukaImage from "../assets/banja-luka.png";
import beogradImage from "../assets/beograd.png";
import zagrebImage from "../assets/zagreb.png";
import ljubljanaImage from "../assets/ljubljana.png";
import budvaImage from "../assets/budva.png";
import sarajevoImage from "../assets/sarajevo.png";
import prijedorImage from "../assets/prijedor.png";
import gradiskaImage from "../assets/gradiska.png";
import dobojImage from "../assets/doboj.png";
import eventCardBg from "../assets/89bb26cd8326bce9428238434c0c748f29da8ece.png";
import newEventCardBg from "../assets/b4eb92f2d8dabb323b7bbcfe325643ecf2317bad.png";
import latestEventCardBg from "../assets/d3b7ae5072e14ac7566a2b3ff69d9798aefa4aa5.png";

export function HomePage() {
  const { t, language } = useT();
  const navigate = useNavigate();
  const hasBanner = useBannerExists("horizontal");
  const hasSquareBanners = useBannerExists("square");
  const {
    selectedCity,
    getCityInLocative,
    setIsCityPopupOpen,
    citySearchQuery,
    setCitySearchQuery,
    setSelectedCity,
  } = useLocation();
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [lightboxTitle, setLightboxTitle] = useState<string>("");
  const [lightboxAuthor, setLightboxAuthor] = useState<string>("");
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [selectedStartDate, setSelectedStartDate] = useState<Date | null>(null);
  const [selectedEndDate, setSelectedEndDate] = useState<Date | null>(null);
  const [selectedDateRange, setSelectedDateRange] = useState<string>("");
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [hoverDate, setHoverDate] = useState<Date | null>(null);
  const [isSearchMenuOpen, setIsSearchMenuOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [featuredEvents, setFeaturedEvents] = useState<Item[]>([]);
  const [featuredConcerts, setFeaturedConcerts] = useState<Item[]>([]);
  const [featuredCinema, setFeaturedCinema] = useState<Item[]>([]);
  const [featuredTheatre, setFeaturedTheatre] = useState<Item[]>([]);
  const [featuredFoodAndDrink, setFeaturedFoodAndDrink] = useState<Item[]>([]);
  const [featuredClubs, setFeaturedClubs] = useState<Item[]>([]);
  const [topOtherCities, setTopOtherCities] = useState<
    Array<{ key: string; label: string; count: number }>
  >([]);
  const [sectionsLoading, setSectionsLoading] = useState(true);
  const [searchResults, setSearchResults] = useState<any[]>([]); // ✅ NEW: Search results
  const [searchLoading, setSearchLoading] = useState(false); // ✅ NEW: Search loading state
  const [interestCounts, setInterestCounts] = useState<Record<string, number>>(
    {},
  );
  const searchShellRef = useRef<HTMLDivElement>(null);

  const isFeaturedEventItem = (event: Item) => {
    const featured = event as Item & {
      is_featured?: boolean;
      featured?: boolean;
      starred?: boolean;
    };
    return Boolean(
      featured.is_featured || featured.featured || featured.starred,
    );
  };

  const getNextStartAt = (event: Item, now: Date): Date | null => {
    const slots = eventService.getEventScheduleSlots(event);
    const nextSlot = slots.find((slot) => new Date(slot.start_at) >= now);
    if (nextSlot) return new Date(nextSlot.start_at);
    if (event.start_at) {
      const start = new Date(event.start_at);
      if (!isNaN(start.getTime()) && start >= now) return start;
    }
    return null;
  };

  const isEventNotFinished = (event: Item, now: Date): boolean => {
    const slots = eventService.getEventScheduleSlots(event);
    if (slots.length > 0) {
      return slots.some(
        (slot) => new Date(slot.end_at || slot.start_at) >= now,
      );
    }
    if (event.end_at) return new Date(event.end_at) >= now;
    if (event.start_at) return new Date(event.start_at) >= now;
    return false;
  };

  const sortByNextStartAsc = (events: Item[], now: Date) =>
    [...events].sort((a, b) => {
      const aTime =
        getNextStartAt(a, now)?.getTime() ?? Number.MAX_SAFE_INTEGER;
      const bTime =
        getNextStartAt(b, now)?.getTime() ?? Number.MAX_SAFE_INTEGER;
      return aTime - bTime;
    });

  const pickFeaturedThenUpcoming = (
    events: Item[],
    limit: number,
    now: Date,
  ) => {
    const upcoming = sortByNextStartAsc(
      events.filter((event) => Boolean(getNextStartAt(event, now))),
      now,
    );
    const featured = upcoming.filter((event) => isFeaturedEventItem(event));
    const selectedFeatured = featured.slice(0, limit);
    const selectedIds = new Set(selectedFeatured.map((event) => event.id));
    const fallback = upcoming.filter((event) => !selectedIds.has(event.id));
    return [...selectedFeatured, ...fallback].slice(0, limit);
  };

  const pickFeaturedThenFallbackVenues = (
    featured: Item[],
    fallback: Item[],
    limit: number,
  ) => {
    const sortedFallback = [...fallback].sort(
      (a, b) =>
        new Date(b.created_at || 0).getTime() -
        new Date(a.created_at || 0).getTime(),
    );
    const featuredLimited = featured.slice(0, limit);
    const selectedIds = new Set(featuredLimited.map((item) => item.id));
    const fallbackWithoutDupes = sortedFallback.filter(
      (item) => !selectedIds.has(item.id),
    );
    return [...featuredLimited, ...fallbackWithoutDupes].slice(0, limit);
  };

  const cityImageByKey: Record<string, string> = {
    [normalizeCityForCompare("Banja Luka")]: banjaLukaImage,
    [normalizeCityForCompare("Beograd")]: beogradImage,
    [normalizeCityForCompare("Zagreb")]: zagrebImage,
    [normalizeCityForCompare("Ljubljana")]: ljubljanaImage,
    [normalizeCityForCompare("Budva")]: budvaImage,
    [normalizeCityForCompare("Sarajevo")]: sarajevoImage,
    [normalizeCityForCompare("Prijedor")]: prijedorImage,
    [normalizeCityForCompare("Gradiška")]: gradiskaImage,
    [normalizeCityForCompare("Doboj")]: dobojImage,
  };

  // Home sections: featured first, then fallback with next upcoming entries
  useEffect(() => {
    async function fetchHomeSections() {
      setSectionsLoading(true);
      const now = new Date();
      const [events, foodVenues, clubsVenues, featuredVenues] =
        await Promise.all([
          eventService.getEvents("all"),
          getVenues("food-and-drink"),
          getVenues("clubs"),
          getFeaturedVenues(),
        ]);

      const approvedActiveEvents = events.filter(
        (event) =>
          event.status === "approved" && isEventNotFinished(event, now),
      );
      const eligibleGenericEventsForEventsPage = approvedActiveEvents.filter(
        (event) =>
          getTopLevelPageCategory(event) === "events" &&
          Boolean(getNextStartAt(event, now)),
      );
      const selectedCityKey = normalizeCityForCompare(selectedCity);
      const inSelectedCity = approvedActiveEvents.filter(
        (event) => normalizeCityForCompare(event.city) === selectedCityKey,
      );

      const eventsBucket = inSelectedCity.filter(
        (event) => getTopLevelPageCategory(event) === "events",
      );
      const concertsBucket = inSelectedCity.filter(
        (event) => getTopLevelPageCategory(event) === "concerts",
      );
      const cinemaBucket = inSelectedCity.filter(
        (event) => getTopLevelPageCategory(event) === "cinema",
      );
      const theatreBucket = inSelectedCity.filter(
        (event) => getTopLevelPageCategory(event) === "theatre",
      );

      const selectedFood = foodVenues.filter(
        (venue) =>
          !venue.city ||
          normalizeCityForCompare(venue.city) === selectedCityKey,
      );
      const selectedClubs = clubsVenues.filter(
        (venue) =>
          !venue.city ||
          normalizeCityForCompare(venue.city) === selectedCityKey,
      );
      const featuredFood = featuredVenues.filter(
        (venue) =>
          venue.page_slug === "food-and-drink" &&
          (!venue.city ||
            normalizeCityForCompare(venue.city) === selectedCityKey),
      );
      const featuredClubVenues = featuredVenues.filter(
        (venue) =>
          venue.page_slug === "clubs" &&
          (!venue.city ||
            normalizeCityForCompare(venue.city) === selectedCityKey),
      );

      const topGenericEvents = pickFeaturedThenUpcoming(eventsBucket, 4, now);
      const topConcerts = pickFeaturedThenUpcoming(concertsBucket, 3, now);
      const topCinema = pickFeaturedThenUpcoming(cinemaBucket, 5, now);
      const topTheatre = pickFeaturedThenUpcoming(theatreBucket, 3, now);
      const topFood = pickFeaturedThenFallbackVenues(
        featuredFood,
        selectedFood.length > 0 ? selectedFood : foodVenues,
        3,
      );
      const topClubs = pickFeaturedThenFallbackVenues(
        featuredClubVenues,
        selectedClubs.length > 0 ? selectedClubs : clubsVenues,
        4,
      );

      setFeaturedEvents(topGenericEvents);
      setFeaturedConcerts(topConcerts);
      setFeaturedCinema(topCinema);
      setFeaturedTheatre(topTheatre);
      setFeaturedFoodAndDrink(topFood);
      setFeaturedClubs(topClubs);
      setTopOtherCities(
        getTopCities(eligibleGenericEventsForEventsPage, 8)
          .filter((city) => city.key !== selectedCityKey)
          .slice(0, 4),
      );
      setSectionsLoading(false);

      const freeEventIds = [
        ...topGenericEvents,
        ...topConcerts,
        ...topCinema,
        ...topTheatre,
      ]
        .filter((event) => /^(free|besplatn|gratis)/i.test(event.price || ""))
        .map((event) => event.id);
      if (freeEventIds.length > 0) {
        const counts = await eventService.batchGetInterestCounts(freeEventIds);
        setInterestCounts(counts);
      } else {
        setInterestCounts({});
      }
    }
    fetchHomeSections();
  }, [selectedCity]);

  // ✅ NEW: Live search effect
  useEffect(() => {
    async function performSearch() {
      if (!searchQuery.trim()) {
        setSearchResults([]);
        return;
      }

      setSearchLoading(true);
      try {
        const events = await eventService.getEvents("upcoming");
        const lowerQuery = searchQuery.toLowerCase();

        const filtered = events.filter((event) => {
          const titleMatch = (
            language === "sr" ? event.title : event.title_en || event.title
          )
            .toLowerCase()
            .includes(lowerQuery);
          const descMatch = (
            language === "sr"
              ? event.description
              : event.description_en || event.description
          )
            .toLowerCase()
            .includes(lowerQuery);
          const categoryMatch = (event.event_type || event.page_slug || "")
            .toLowerCase()
            .includes(lowerQuery);

          return titleMatch || descMatch || categoryMatch;
        });

        setSearchResults(filtered.slice(0, 5)); // Show max 5 results
      } catch (error) {
        console.error("Search error:", error);
        setSearchResults([]);
      } finally {
        setSearchLoading(false);
      }
    }

    const timeoutId = setTimeout(performSearch, 300); // Debounce 300ms
    return () => clearTimeout(timeoutId);
  }, [searchQuery, language]);

  useEffect(() => {
    if (!isSearchMenuOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      const root = searchShellRef.current;
      if (!root || root.contains(e.target as Node)) return;
      setIsSearchMenuOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [isSearchMenuOpen]);

  const homeTitle = useMemo(
    () => homeDocumentTitle(selectedCity),
    [selectedCity],
  );
  useDocumentTitle(homeTitle);

  // SEO optimization for home page
  useSEO({
    title: t("seoHomeTitle"),
    description: t("seoHomeDescription"),
    keywords: t("seoHomeKeywords"),
    ogImage: ogImage,
    ogType: "website",
    canonical: SITE_URL + "/",
    structuredData: {
      "@context": "https://schema.org",
      "@graph": [
        getWebSiteSchema(),
        getTouristDestinationSchema(),
        getBreadcrumbSchema([{ name: t("home"), url: SITE_URL + "/" }]),
      ],
    },
  });

  return (
    <div className="min-h-screen bg-white">
      {/* HERO SECTION - AllEvents Style */}
      <section
        className="relative w-full"
        style={{
          height: "420px",
          background: `linear-gradient(rgba(0, 0, 0, 0.65), rgba(0, 0, 0, 0.65)), url('${heroBackgroundImage}') center/cover`,
        }}
      >
        <div className="relative z-10 h-full flex flex-col items-center justify-center px-4">
          {/* Hero Title */}
          <h1
            className="text-center mb-3"
            style={{
              fontSize: "42px",
              fontWeight: 700,
              color: "#FFFFFF",
              textShadow:
                "0 0 20px rgba(255,255,255,0.8), 0 0 30px rgba(255,255,255,0.6), 3px 3px 10px rgba(0,0,0,0.9)",
              margin: 0,
            }}
          >
            <span style={{ color: "#0E3DC5" }}>{t("heroTitleDiscover")}</span>{" "}
            <span>{t("heroTitleRest")}</span>
          </h1>

          {/* Hero Subtitle */}
          <p
            className="text-center mb-8"
            style={{
              fontSize: "18px",
              color: "#FFFFFF",
              textShadow:
                "0 0 15px rgba(255,255,255,0.7), 0 0 25px rgba(255,255,255,0.5), 2px 2px 8px rgba(0,0,0,0.9)",
              maxWidth: "600px",
              margin: "0 auto 32px",
            }}
          >
            {t("heroSubtitle")}
          </p>

          {/* Search Bar */}
          <div
            ref={searchShellRef}
            className="w-full max-w-2xl bg-white rounded-md shadow-lg relative"
            style={{
              padding: "8px",
              display: "flex",
              alignItems: "center",
              gap: "12px",
            }}
          >
            <div className="flex-1 flex items-center gap-3 px-3">
              <button
                onClick={() => {
                  // Build search URL with parameters
                  const params = new URLSearchParams();
                  params.set("city", selectedCity);
                  if (selectedDateRange) params.set("date", selectedDateRange);
                  if (selectedCategory)
                    params.set("category", selectedCategory);
                  if (searchQuery) params.set("q", searchQuery);
                  navigate(`/search?${params.toString()}`);
                }}
                className="hover:opacity-70 hover:scale-110 transition-all"
                style={{
                  border: "none",
                  background: "transparent",
                  cursor: "pointer",
                  padding: 0,
                }}
                title={language === "sr" ? "Pretraži" : "Search"}
                aria-label={language === "sr" ? "Pretraži" : "Search"}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#0E3DC5"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="11" cy="11" r="8" />
                  <path d="m21 21-4.35-4.35" />
                </svg>
              </button>
              <input
                type="text"
                placeholder={t("search")}
                value={searchQuery || selectedCategory}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setSelectedCategory("");
                  setIsSearchMenuOpen(true);
                }}
                onFocus={() => setIsSearchMenuOpen(true)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    // Build search URL with parameters
                    const params = new URLSearchParams();
                    params.set("city", selectedCity);
                    if (selectedDateRange)
                      params.set("date", selectedDateRange);
                    if (selectedCategory)
                      params.set("category", selectedCategory);
                    if (searchQuery) params.set("q", searchQuery);
                    navigate(`/search?${params.toString()}`);
                    setIsSearchMenuOpen(false);
                  }
                }}
                className="flex-1 border-0 outline-none"
                style={{
                  fontSize: "16px",
                  fontWeight: 500,
                  color:
                    searchQuery || selectedCategory ? "#0E3DC5" : "#9CA3AF",
                  background: "transparent",
                  cursor: "text",
                }}
              />
              {(searchQuery || selectedCategory) && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedCategory("");
                    setSearchQuery("");
                  }}
                  className="hover:bg-gray-100 rounded-full p-1 transition-colors"
                  style={{
                    border: "none",
                    background: "transparent",
                    cursor: "pointer",
                  }}
                >
                  <X size={16} style={{ color: "#6B7280" }} />
                </button>
              )}
            </div>

            {/* Date Picker Icon */}
            <div
              className="px-4 py-2 cursor-pointer flex items-center gap-2"
              onClick={() => setIsDatePickerOpen(!isDatePickerOpen)}
            >
              {selectedDateRange ? (
                <span
                  style={{
                    fontSize: "15px",
                    fontWeight: 500,
                    color: "#0E3DC5",
                  }}
                >
                  {selectedDateRange}
                </span>
              ) : (
                <CalendarDays size={18} style={{ color: "#0E3DC5" }} />
              )}
            </div>

            {/* Location Dropdown */}
            <div
              className="flex items-center gap-2 px-4 py-2 border-l"
              style={{
                borderColor: "#E5E9F0",
                cursor: "pointer",
              }}
              onClick={() => setIsCityPopupOpen(true)}
            >
              <MapPinned size={18} style={{ color: "#0E3DC5" }} />
              <span
                style={{
                  fontSize: "15px",
                  fontWeight: 500,
                  color: "#1a1a1a",
                }}
              >
                {selectedCity}
              </span>
              <ChevronDown size={16} style={{ color: "#6B7280" }} />
            </div>

            {/* Search Results Dropdown */}
            {isSearchMenuOpen && (
              <div
                className="absolute top-full mt-2 left-0 right-0 bg-white rounded-lg shadow-xl z-50 overflow-hidden max-h-[500px] overflow-y-auto"
                style={{
                  border: "1px solid #E5E9F0",
                }}
              >
                <div className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3
                      className="text-sm font-semibold"
                      style={{ color: "#6B7280" }}
                    >
                      {searchQuery
                        ? language === "sr"
                          ? "REZULTATI PRETRAGE"
                          : "SEARCH RESULTS"
                        : language === "sr"
                          ? "PRETRAŽI DOGAĐAJE"
                          : "SEARCH EVENTS"}
                    </h3>
                    <button
                      onClick={() => setIsSearchMenuOpen(false)}
                      className="p-1 hover:bg-gray-100 rounded transition-colors"
                      style={{
                        border: "none",
                        background: "transparent",
                        cursor: "pointer",
                      }}
                    >
                      <X size={18} style={{ color: "#6B7280" }} />
                    </button>
                  </div>

                  {/* Search Results */}
                  {searchLoading ? (
                    <div className="text-center py-8">
                      <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-gray-200 border-t-blue-600"></div>
                      <p className="mt-2 text-sm text-gray-600">
                        {language === "sr" ? "Pretraga..." : "Searching..."}
                      </p>
                    </div>
                  ) : !searchQuery.trim() ? (
                    <div
                      className="text-center py-8"
                      style={{ color: "#6B7280" }}
                    >
                      {language === "sr"
                        ? "Unesite naziv događaja, mjesta ili opis..."
                        : "Enter event name, venue, or description..."}
                    </div>
                  ) : searchResults.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-gray-600 mb-2">
                        {language === "sr"
                          ? "Nema rezultata za vašu pretragu"
                          : "No results found"}
                      </p>
                      <button
                        onClick={() => {
                          const params = new URLSearchParams();
                          params.set("city", selectedCity);
                          if (searchQuery) params.set("q", searchQuery);
                          navigate(`/search?${params.toString()}`);
                          setIsSearchMenuOpen(false);
                        }}
                        className="mt-2 px-4 py-2 rounded-lg text-white font-medium transition-all hover:opacity-90"
                        style={{
                          background: "#0E3DC5",
                          border: "none",
                          cursor: "pointer",
                        }}
                      >
                        {language === "sr"
                          ? "Prikaži sve rezultate"
                          : "Show all results"}
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="space-y-2">
                        {searchResults.map((event) => (
                          <Link
                            key={event.id}
                            to={eventDetailPath(event)}
                            className="flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-all hover:bg-blue-50"
                            style={{
                              border: "1px solid #E5E9F0",
                              textDecoration: "none",
                              color: "inherit",
                            }}
                            onClick={() => {
                              setIsSearchMenuOpen(false);
                              setSearchQuery("");
                            }}
                          >
                            {/* Event Image */}
                            <img
                              src={
                                event.image ||
                                "https://images.unsplash.com/photo-1540039155733-5bb30b53aa14?w=800"
                              }
                              alt={
                                language === "sr"
                                  ? event.title
                                  : event.title_en || event.title
                              }
                              className="w-16 h-16 object-cover rounded-md flex-shrink-0"
                            />

                            {/* Event Info */}
                            <div className="flex-1 min-w-0">
                              <h4
                                className="text-sm font-semibold mb-1 line-clamp-1"
                                style={{ color: "#1a1a1a" }}
                              >
                                {language === "sr"
                                  ? event.title
                                  : event.title_en || event.title}
                              </h4>
                              <p className="text-xs text-gray-600 mb-1 line-clamp-1">
                                {language === "sr"
                                  ? event.description
                                  : event.description_en || event.description}
                              </p>
                              <div className="flex items-center gap-3 text-xs text-gray-500">
                                {event.start_at && (
                                  <span className="flex items-center gap-1">
                                    <CalendarDays size={12} />
                                    {eventService.getRelativeDateLabel(
                                      event.start_at,
                                      language,
                                    )}
                                  </span>
                                )}
                                {event.event_type && (
                                  <span
                                    className="px-2 py-0.5 rounded"
                                    style={{
                                      background: "#E8F0FE",
                                      color: "#0E3DC5",
                                    }}
                                  >
                                    {eventService.translateEventType(
                                      event.event_type,
                                      language,
                                    )}
                                  </span>
                                )}
                              </div>
                            </div>
                          </Link>
                        ))}
                      </div>

                      {/* Show All Results Button */}
                      <button
                        onClick={() => {
                          const params = new URLSearchParams();
                          params.set("city", selectedCity);
                          if (searchQuery) params.set("q", searchQuery);
                          navigate(`/search?${params.toString()}`);
                          setIsSearchMenuOpen(false);
                          setSearchQuery("");
                        }}
                        className="mt-3 w-full px-4 py-2 rounded-lg text-white font-medium transition-all hover:opacity-90"
                        style={{
                          background: "#0E3DC5",
                          border: "none",
                          cursor: "pointer",
                        }}
                      >
                        {language === "sr"
                          ? `Prikaži sve rezultate (${searchResults.length}+)`
                          : `Show all results (${searchResults.length}+)`}
                      </button>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* BANNER AD - ODMAH ISPOD HERO SEKCIJE */}
      {hasBanner && (
        <div className="w-[60vw] mx-auto py-12">
          <BannerAd type="horizontal" />
        </div>
      )}

      {/* EVENTS - FULL WIDTH WITH GRADIENT */}
      <section
        className="py-12 overflow-hidden"
        style={{
          background: BACKGROUNDS.white,
        }}
      >
        <div className="w-[60vw] mx-auto">
          <h2
            className="text-left cursor-pointer transition-all hover:opacity-80 inline-block"
            style={{
              fontSize: "24px",
              fontWeight: 600,
              marginBottom: "24px",
              ...getGradientTextStyle(GRADIENTS.events),
            }}
          >
            <Link
              to="/events"
              style={{ textDecoration: "none", color: "inherit" }}
            >
              {t("events")}
            </Link>
          </h2>

          {/*
            VAŽNO: Ova sekcija prikazuje TAČNO 4 FEATURED EVENTA IZ BACKEND-a
            Eventi se povlače iz Supabase submissions tabele (approved status, upcoming events)
            Nova dešavanja koja korisnici prijavljuju se automatski prikazuju kada admin odobri.
          */}

          {/* Loading State */}
          {sectionsLoading && (
            <div className="text-center py-12">
              <p className="text-lg" style={{ color: "#6B7280" }}>
                {language === "sr"
                  ? "Učitavanje događaja..."
                  : "Loading events..."}
              </p>
            </div>
          )}

          {/* Empty State */}
          {!sectionsLoading && featuredEvents.length === 0 && (
            <div className="text-center py-12">
              <CalendarDays
                size={48}
                style={{ color: "#E5E9F0", margin: "0 auto 16px" }}
              />
              <p className="text-lg" style={{ color: "#6B7280" }}>
                {language === "sr"
                  ? "U pripremi — uskoro će biti dostupno!"
                  : "Under construction — coming soon!"}
              </p>
            </div>
          )}

          {/* Events Grid */}
          {!sectionsLoading && featuredEvents.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {featuredEvents.map((event) => {
                // Map lowercase DB values to PascalCase translation keys
                const typeToKey: Record<string, string> = {
                  music: "Music",
                  festival: "Festival",
                  party: "Party",
                  art: "Art",
                  gastro: "Gastro",
                  sport: "Sport",
                  event: "Event",
                };
                const eventTypeKey =
                  typeToKey[
                    (
                      event.event_type ||
                      event.page_slug ||
                      "event"
                    ).toLowerCase()
                  ] || "Event";

                return (
                  <RevealOnScrollArticle key={event.id}>
                    <Link
                      to={eventDetailPath(event)}
                      className="cursor-pointer hover:scale-[1.02] transition-all duration-300 block"
                      style={{ textDecoration: "none", color: "inherit" }}
                    >
                      {/* Image */}
                      <img
                        src={
                          event.image ||
                          "https://images.unsplash.com/photo-1540039155733-5bb30b53aa14?w=800"
                        }
                        alt={event.title}
                        className="w-full h-[200px] object-cover rounded-md"
                      />

                      {/* Content ISPOD SLIKE */}
                      <div className="p-4">
                        {/* Category and Badge */}
                        <div className="flex items-center gap-2 mb-2">
                          <span
                            className="text-xs font-medium px-2 py-1 rounded"
                            style={{
                              background: BACKGROUNDS.lightGray,
                              color: CATEGORY_COLORS.events,
                            }}
                          >
                            {t(
                              `category${eventTypeKey}` as keyof typeof translations,
                            )}
                          </span>
                          {event.price === "Free" && (
                            <span
                              className="text-xs font-medium px-2 py-1 rounded"
                              style={{
                                background: BACKGROUNDS.lightGray,
                                color: TEXT.tertiary,
                              }}
                            >
                              {language === "sr"
                                ? "Besplatan ulaz"
                                : "Free Entry"}
                            </span>
                          )}
                        </div>

                        {/* Title */}
                        <h3
                          className="text-base font-semibold mb-2 line-clamp-2"
                          style={{ color: "#1a1a1a" }}
                        >
                          {language === "sr"
                            ? event.title
                            : event.title_en || event.title}
                        </h3>

                        {/* Date & Time */}
                        {event.start_at && (
                          <>
                            <div className="flex items-center gap-2 mb-1">
                              <CalendarDays
                                size={14}
                                style={{ color: "#6B7280" }}
                              />
                              <span
                                className="text-sm"
                                style={{ color: "#6B7280" }}
                              >
                                {eventService.getRelativeDateLabel(
                                  event.start_at,
                                  language,
                                )}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 mb-1">
                              <Clock size={14} style={{ color: "#6B7280" }} />
                              <span
                                className="text-sm"
                                style={{ color: "#6B7280" }}
                              >
                                {eventService.formatEventTime(
                                  event.start_at,
                                  event.end_at,
                                  language === "en" ? "en" : "sr",
                                )}
                              </span>
                            </div>
                          </>
                        )}

                        {/* Venue */}
                        {(event.venue_name || event.address) && (
                          <div className="flex items-center gap-2">
                            <MapPin size={14} style={{ color: "#6B7280" }} />
                            <span
                              className="text-sm"
                              style={{ color: "#6B7280" }}
                            >
                              {event.venue_name || event.address}
                            </span>
                          </div>
                        )}

                        {/* Interest count for free events */}
                        {interestCounts[event.id] > 0 && (
                          <div className="flex items-center gap-1.5 mt-1">
                            <Heart size={12} style={{ color: "#FB8C00" }} />
                            <span
                              className="text-xs"
                              style={{ color: "#9CA3AF" }}
                            >
                              {interestCounts[event.id]}{" "}
                              {language === "sr"
                                ? "zainteresovano"
                                : "interested"}
                            </span>
                          </div>
                        )}
                      </div>
                    </Link>
                  </RevealOnScrollArticle>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* SQUARE BANNERS - 3 BANNERA JEDAN PORED DRUGOG */}
      {hasSquareBanners && (
        <div className="w-[60vw] mx-auto py-12">
          <SquareBannersGrid />
        </div>
      )}

      {/* THEATRE SECTION - FULL WIDTH */}
      <section
        className="py-12 overflow-hidden"
        style={{
          background: BACKGROUNDS.lightBlue,
        }}
      >
        <div className="w-[60vw] mx-auto">
          <h2
            className="text-left cursor-pointer transition-all hover:opacity-80 inline-block"
            style={{
              fontSize: "24px",
              fontWeight: 600,
              marginBottom: "24px",
              ...getGradientTextStyle(GRADIENTS.theatre),
            }}
          >
            <Link
              to="/theatre"
              style={{ textDecoration: "none", color: "inherit" }}
            >
              {language === "sr" ? "Pozorište" : "Theatre"}
            </Link>
          </h2>

          {/*
            VAŽNO: Ova sekcija prikazuje TAČNO 3 FEATURED THEATRE PREDSTAVE
            NE DODAVATI NOVE PREDSTAVE OVDJE!
            Nova dešavanja koja korisnici prijavljuju kroz Submit Event formu
            treba da se prikazuju samo na /events/all stranici.
          */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {featuredTheatre.map((show) => (
              <RevealOnScrollArticle key={show.id}>
                <div className="cursor-pointer hover:scale-[1.02] transition-all duration-300">
                  <Link
                    to={`/theatre/${show.id}`}
                    style={{
                      textDecoration: "none",
                      color: "inherit",
                      display: "block",
                    }}
                  >
                    {/* Image */}
                    <img
                      src={show.image}
                      alt={show.title}
                      className="w-full h-[400px] object-cover rounded-md"
                    />

                    {/* Content ISPOD SLIKE */}
                    <div className="p-4">
                      {/* Category and Badge */}
                      <div className="flex items-center gap-2 mb-2">
                        <span
                          className="text-xs font-medium px-2 py-1 rounded"
                          style={{
                            background: BACKGROUNDS.gray,
                            color: CATEGORY_COLORS.theatre,
                          }}
                        >
                          {eventService.translateEventType(
                            show.event_type || show.page_slug || "",
                            language,
                          )}
                        </span>
                        {/^(free|besplatn|gratis)/i.test(show.price || "") && (
                          <span
                            className="text-xs font-medium px-2 py-1 rounded"
                            style={{
                              background: BACKGROUNDS.lightGray,
                              color: TEXT.tertiary,
                            }}
                          >
                            {language === "sr"
                              ? "Besplatan ulaz"
                              : "Free Entry"}
                          </span>
                        )}
                      </div>

                      {/* Title */}
                      <h3
                        className="text-base font-semibold mb-2"
                        style={{ color: "#1a1a1a" }}
                      >
                        {language === "sr"
                          ? show.title
                          : show.title_en || show.title}
                      </h3>

                      {/* Date */}
                      <div className="flex items-center gap-2 mb-1">
                        <CalendarDays size={14} style={{ color: "#6B7280" }} />
                        <span className="text-sm" style={{ color: "#6B7280" }}>
                          {show.start_at
                            ? eventService.getRelativeDateLabel(
                                show.start_at,
                                language,
                              )
                            : ""}
                        </span>
                      </div>
                      {show.start_at && (
                        <div className="flex items-center gap-2 mb-1">
                          <Clock size={14} style={{ color: "#6B7280" }} />
                          <span
                            className="text-sm"
                            style={{ color: "#6B7280" }}
                          >
                            {eventService.formatEventTime(
                              show.start_at,
                              show.end_at,
                              language === "en" ? "en" : "sr",
                            )}
                          </span>
                        </div>
                      )}

                      {/* Venue / grad */}
                      <div className="flex items-center gap-2">
                        {String(show.venue_name || "").trim() ||
                        String(show.address || "").trim() ? (
                          <MapPin size={14} style={{ color: "#6B7280" }} />
                        ) : (
                          <MapPinned size={14} style={{ color: "#6B7280" }} />
                        )}
                        <span className="text-sm" style={{ color: "#6B7280" }}>
                          {show.venue_name || show.address || show.city}
                        </span>
                      </div>
                    </div>
                  </Link>
                </div>
              </RevealOnScrollArticle>
            ))}
          </div>
        </div>
      </section>

      {/* CINEMA SECTION - FULL WIDTH */}
      <section
        className="py-12 overflow-hidden"
        style={{
          background: BACKGROUNDS.lightBlue,
        }}
      >
        <div className="w-[60vw] mx-auto">
          <h2
            className="text-left cursor-pointer transition-all hover:opacity-80 inline-block"
            style={{
              fontSize: "24px",
              fontWeight: 600,
              marginBottom: "24px",
              ...getGradientTextStyle(GRADIENTS.cinema),
            }}
          >
            <Link
              to="/cinema"
              style={{ textDecoration: "none", color: "inherit" }}
            >
              {language === "sr" ? "Bioskop" : "Cinema"}
            </Link>
          </h2>

          {/*
            VAŽNO: Ova sekcija prikazuje TAČNO 5 FEATURED FILMOVA
            NE DODAVATI NOVE FILMOVE OVDJE!
            Novi filmovi treba da se prikazuju samo na /cinema/all stranici.
          */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {featuredCinema.map((movie) => (
              <RevealOnScrollArticle key={movie.id}>
                <div className="cursor-pointer hover:scale-[1.02] transition-all duration-300">
                  <Link
                    to={`/cinema/${movie.id}`}
                    style={{
                      textDecoration: "none",
                      color: "inherit",
                      display: "block",
                    }}
                  >
                    {/* Image */}
                    <img
                      src={movie.image}
                      alt={
                        language === "sr"
                          ? movie.title
                          : movie.title_en || movie.title
                      }
                      className="w-full h-[250px] object-cover rounded-md"
                    />

                    {/* Content ISPOD SLIKE */}
                    <div className="p-4">
                      {/* Category and Rating */}
                      <div className="flex items-center gap-2 mb-2">
                        <span
                          className="text-xs font-medium px-2 py-1 rounded"
                          style={{
                            background: BACKGROUNDS.lightGray,
                            color: CATEGORY_COLORS.cinema,
                          }}
                        >
                          {eventService.translateEventType(
                            movie.event_type || movie.page_slug || "",
                            language,
                          )}
                        </span>
                      </div>

                      {/* Title */}
                      <h3
                        className="text-base font-semibold mb-2"
                        style={{ color: "#1a1a1a" }}
                      >
                        {language === "sr"
                          ? movie.title
                          : movie.title_en || movie.title}
                      </h3>

                      {/* Date */}
                      <div className="flex items-center gap-2 mb-1">
                        <CalendarDays size={14} style={{ color: "#6B7280" }} />
                        <span className="text-sm" style={{ color: "#6B7280" }}>
                          {movie.start_at
                            ? eventService.getRelativeDateLabel(
                                movie.start_at,
                                language,
                              )
                            : ""}
                        </span>
                      </div>
                      {movie.start_at && (
                        <div className="flex items-center gap-2 mb-1">
                          <Clock size={14} style={{ color: "#6B7280" }} />
                          <span
                            className="text-sm"
                            style={{ color: "#6B7280" }}
                          >
                            {eventService.formatEventTime(
                              movie.start_at,
                              movie.end_at,
                              language === "en" ? "en" : "sr",
                            )}
                          </span>
                        </div>
                      )}

                      {/* Venue / grad */}
                      <div className="flex items-center gap-2">
                        {String(movie.venue_name || "").trim() ||
                        String(movie.address || "").trim() ? (
                          <MapPin size={14} style={{ color: "#6B7280" }} />
                        ) : (
                          <MapPinned size={14} style={{ color: "#6B7280" }} />
                        )}
                        <span className="text-sm" style={{ color: "#6B7280" }}>
                          {movie.venue_name || movie.address || movie.city}
                        </span>
                      </div>
                    </div>
                  </Link>
                </div>
              </RevealOnScrollArticle>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURED RESTAURANTS - FULL WIDTH BACKGROUND */}
      <section className="py-12" style={{ background: BACKGROUNDS.white }}>
        <div className="w-[60vw] mx-auto">
          <h2
            className="text-left cursor-pointer transition-all hover:opacity-80 inline-block"
            style={{
              fontSize: "24px",
              fontWeight: 600,
              marginBottom: "24px",
              ...getGradientTextStyle(GRADIENTS.foodAndDrink),
            }}
          >
            <Link
              to="/food-and-drink"
              style={{ textDecoration: "none", color: "inherit" }}
            >
              {t("foodAndDrink")}
            </Link>
          </h2>

          {/*
            VAŽNO: Ova sekcija prikazuje TAČNO 3 FEATURED RESTORANA
            NE DODAVATI NOVE RESTORANE OVDJE!
            Novi restorani treba da se prikazuju samo na /food-and-drink stranici.
          */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {featuredFoodAndDrink.map((restaurant) => (
              <RevealOnScrollArticle key={restaurant.id}>
                <div className="cursor-pointer hover:scale-[1.02] transition-all duration-300">
                  <Link
                    to={venueDetailPath(restaurant)}
                    style={{
                      textDecoration: "none",
                      color: "inherit",
                      display: "block",
                    }}
                  >
                    <img
                      src={restaurant.image}
                      alt={restaurant.title}
                      className="w-full h-[350px] object-cover rounded-md"
                    />
                    <div className="p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <span
                          className="text-xs font-medium px-2 py-1 rounded"
                          style={{
                            background: BACKGROUNDS.lightGray,
                            color: CATEGORY_COLORS.foodAndDrink,
                          }}
                        >
                          {restaurant.cuisine_en && language === "en"
                            ? restaurant.cuisine_en
                            : restaurant.cuisine ||
                              restaurant.venue_type ||
                              t("foodAndDrink")}
                        </span>
                      </div>
                      <h3
                        className="text-base font-semibold mb-2"
                        style={{ color: "#1a1a1a" }}
                      >
                        {language === "sr"
                          ? restaurant.title
                          : restaurant.title_en || restaurant.title}
                      </h3>
                      <div className="flex items-center gap-2 mb-1">
                        {String(restaurant.address || "").trim() ? (
                          <MapPin size={14} style={{ color: "#6B7280" }} />
                        ) : (
                          <MapPinned size={14} style={{ color: "#6B7280" }} />
                        )}
                        <span className="text-sm" style={{ color: "#6B7280" }}>
                          {restaurant.address ||
                            restaurant.city ||
                            selectedCity}
                        </span>
                      </div>
                      {restaurant.opening_hours && (
                        <VenueOpeningHoursRow
                          hoursText={
                            language === "en" && restaurant.opening_hours_en
                              ? restaurant.opening_hours_en
                              : restaurant.opening_hours
                          }
                        />
                      )}
                    </div>
                  </Link>
                </div>
              </RevealOnScrollArticle>
            ))}
          </div>
        </div>
      </section>

      {/* CLUBS SECTION */}
      <section className="py-12" style={{ background: BACKGROUNDS.lightBlue }}>
        <div className="w-[60vw] mx-auto">
          <h2
            className="text-left cursor-pointer transition-all hover:opacity-80 inline-block"
            style={{
              fontSize: "24px",
              fontWeight: 600,
              marginBottom: "24px",
              ...getGradientTextStyle(GRADIENTS.clubs),
            }}
          >
            <Link
              to="/clubs"
              style={{ textDecoration: "none", color: "inherit" }}
            >
              {language === "sr" ? "Klubovi" : "Clubs"}
            </Link>
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {featuredClubs.map((club) => (
              <RevealOnScrollArticle key={club.id}>
                <div className="cursor-pointer hover:scale-[1.02] transition-all duration-300">
                  <Link
                    to={venueDetailPath(club)}
                    style={{
                      textDecoration: "none",
                      color: "inherit",
                      display: "block",
                    }}
                  >
                    {/* Image */}
                    <img
                      src={club.image}
                      alt={club.title}
                      className="w-full h-[200px] object-cover rounded-md"
                    />

                    {/* Content ISPOD SLIKE */}
                    <div className="p-4">
                      {/* Category */}
                      <div className="flex items-center gap-2 mb-2">
                        <span
                          className="text-xs font-medium px-2 py-1 rounded"
                          style={{
                            background: BACKGROUNDS.lightGray,
                            color: CATEGORY_COLORS.clubs,
                          }}
                        >
                          {club.venue_type ||
                            (language === "sr" ? "Klub" : "Club")}
                        </span>
                      </div>

                      {/* Title */}
                      <h3
                        className="text-base font-semibold mb-1"
                        style={{ color: "#1a1a1a" }}
                      >
                        {language === "sr"
                          ? club.title
                          : club.title_en || club.title}
                      </h3>

                      {/* Type */}
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm" style={{ color: "#6B7280" }}>
                          {club.description_en && language === "en"
                            ? club.description_en
                            : club.description}
                        </span>
                      </div>

                      {/* Opens / hours */}
                      <div className="flex items-center gap-2">
                        <Clock size={14} style={{ color: "#6B7280" }} />
                        <span className="text-sm" style={{ color: "#6B7280" }}>
                          {club.opening_hours_en && language === "en"
                            ? club.opening_hours_en
                            : club.opening_hours || club.city}
                        </span>
                      </div>
                    </div>
                  </Link>
                </div>
              </RevealOnScrollArticle>
            ))}
          </div>
        </div>
      </section>

      {/* CONCERTS SECTION */}
      <section className="py-12" style={{ background: BACKGROUNDS.lightBlue }}>
        <div className="w-[60vw] mx-auto">
          <h2
            className="text-left cursor-pointer transition-all hover:opacity-80 inline-block"
            style={{
              fontSize: "24px",
              fontWeight: 600,
              marginBottom: "24px",
              ...getGradientTextStyle(GRADIENTS.concerts),
            }}
          >
            <Link
              to="/concerts"
              style={{ textDecoration: "none", color: "inherit" }}
            >
              {language === "sr" ? "Koncerti" : "Concerts"}
            </Link>
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {featuredConcerts.map((concert) => (
              <RevealOnScrollArticle key={concert.id}>
                <div className="cursor-pointer hover:scale-[1.02] transition-all duration-300">
                  <Link
                    to={`/concerts/${concert.id}`}
                    style={{
                      textDecoration: "none",
                      color: "inherit",
                      display: "block",
                    }}
                  >
                    {/* Image */}
                    <img
                      src={concert.image}
                      alt={concert.title}
                      className="w-full h-[250px] object-cover rounded-md"
                    />

                    {/* Content ISPOD SLIKE */}
                    <div className="p-4">
                      {/* Category and Badge */}
                      <div className="flex items-center gap-2 mb-2">
                        <span
                          className="text-xs font-medium px-2 py-1 rounded"
                          style={{
                            background: BACKGROUNDS.lightGray,
                            color: CATEGORY_COLORS.concerts,
                          }}
                        >
                          {eventService.translateEventType(
                            concert.event_type || concert.page_slug || "",
                            language,
                          )}
                        </span>
                        {/^(free|besplatn|gratis)/i.test(
                          concert.price || "",
                        ) && (
                          <span
                            className="text-xs font-medium px-2 py-1 rounded"
                            style={{
                              background: BACKGROUNDS.lightGray,
                              color: TEXT.tertiary,
                            }}
                          >
                            {language === "sr"
                              ? "Besplatan ulaz"
                              : "Free Entry"}
                          </span>
                        )}
                      </div>

                      {/* Title */}
                      <h3
                        className="text-base font-semibold mb-2"
                        style={{ color: "#1a1a1a" }}
                      >
                        {language === "sr"
                          ? concert.title
                          : concert.title_en || concert.title}
                      </h3>

                      {/* Date */}
                      <div className="flex items-center gap-2 mb-1">
                        <CalendarDays size={14} style={{ color: "#6B7280" }} />
                        <span className="text-sm" style={{ color: "#6B7280" }}>
                          {concert.start_at
                            ? eventService.getRelativeDateLabel(
                                concert.start_at,
                                language,
                              )
                            : ""}
                        </span>
                      </div>
                      {concert.start_at && (
                        <div className="flex items-center gap-2 mb-1">
                          <Clock size={14} style={{ color: "#6B7280" }} />
                          <span
                            className="text-sm"
                            style={{ color: "#6B7280" }}
                          >
                            {eventService.formatEventTime(
                              concert.start_at,
                              concert.end_at,
                              language === "en" ? "en" : "sr",
                            )}
                          </span>
                        </div>
                      )}

                      {/* Venue / grad */}
                      <div className="flex items-center gap-2">
                        {String(concert.venue_name || "").trim() ||
                        String(concert.address || "").trim() ? (
                          <MapPin size={14} style={{ color: "#6B7280" }} />
                        ) : (
                          <MapPinned size={14} style={{ color: "#6B7280" }} />
                        )}
                        <span className="text-sm" style={{ color: "#6B7280" }}>
                          {concert.venue_name ||
                            concert.address ||
                            concert.city}
                        </span>
                      </div>
                    </div>
                  </Link>
                </div>
              </RevealOnScrollArticle>
            ))}
          </div>
        </div>
      </section>

      {/* SOCIAL PROOF GALLERY */}
      <SocialProofGallery language={language} />

      {/* EXPLORE OTHER CITIES - FULL WIDTH BACKGROUND (Istraži ostale gradove) */}
      <section className="py-12" style={{ backgroundColor: "#FFFFFF" }}>
        <div className="w-[60vw] mx-auto">
          <h2
            className="text-left mb-4"
            style={{
              fontSize: "24px",
              fontWeight: 600,
              textShadow: "0 2px 4px rgba(0, 0, 0, 0.1)",
            }}
          >
            {language === "sr"
              ? "Istraži ostale gradove"
              : "Explore other cities"}
          </h2>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
            {topOtherCities.map((item) => (
              <RevealOnScrollArticle key={item.key}>
                <Link
                  to={`/events?city=${encodeURIComponent(item.label)}`}
                  onClick={() => {
                    flushSync(() => {
                      setSelectedCity(item.label);
                    });
                  }}
                  className="relative rounded-md overflow-hidden cursor-pointer hover:scale-[1.02] transition-all duration-300 block"
                  style={{
                    height: "200px",
                    textDecoration: "none",
                    background:
                      "linear-gradient(135deg, rgba(14,61,197,0.9) 0%, rgba(17,24,39,0.95) 100%)",
                  }}
                >
                  {cityImageByKey[item.key] ? (
                    <>
                      <img
                        src={cityImageByKey[item.key]}
                        alt={item.label}
                        className="absolute inset-0 w-full h-full object-cover"
                      />
                      <div
                        className="absolute inset-0"
                        style={{
                          background:
                            "linear-gradient(to top, rgba(0,0,0,0.72) 0%, rgba(0,0,0,0.25) 60%)",
                        }}
                      />
                    </>
                  ) : null}
                  <div className="absolute bottom-3 left-3">
                    <div
                      className="text-white font-semibold mb-1"
                      style={{ fontSize: "16px" }}
                    >
                      {item.label}
                    </div>
                    <div
                      className="text-sm"
                      style={{
                        color: "rgba(255, 255, 255, 0.9)",
                      }}
                    >
                      {item.count} {t("events")}
                    </div>
                  </div>
                </Link>
              </RevealOnScrollArticle>
            ))}
          </div>
        </div>
      </section>

      {/* DATE PICKER MODAL */}
      {isDatePickerOpen &&
        (() => {
          // Calendar helper functions
          const getDaysInMonth = (date: Date) => {
            return new Date(
              date.getFullYear(),
              date.getMonth() + 1,
              0,
            ).getDate();
          };

          const getFirstDayOfMonth = (date: Date) => {
            const day = new Date(
              date.getFullYear(),
              date.getMonth(),
              1,
            ).getDay();
            return day === 0 ? 6 : day - 1; // Convert to Monday = 0
          };

          const isSameDay = (date1: Date | null, date2: Date | null) => {
            if (!date1 || !date2) return false;
            return date1.toDateString() === date2.toDateString();
          };

          const isInRange = (date: Date) => {
            if (!selectedStartDate) return false;
            const compareDate = selectedEndDate || hoverDate;
            if (!compareDate) return false;

            const start =
              selectedStartDate < compareDate ? selectedStartDate : compareDate;
            const end =
              selectedStartDate < compareDate ? compareDate : selectedStartDate;

            return date > start && date < end;
          };

          const isStartOrEnd = (date: Date) => {
            return (
              isSameDay(date, selectedStartDate) ||
              isSameDay(date, selectedEndDate)
            );
          };

          const handleDateClick = (date: Date) => {
            if (!selectedStartDate || (selectedStartDate && selectedEndDate)) {
              // First click or reset
              setSelectedStartDate(date);
              setSelectedEndDate(null);
            } else {
              // Second click
              if (date < selectedStartDate) {
                setSelectedEndDate(selectedStartDate);
                setSelectedStartDate(date);
              } else {
                setSelectedEndDate(date);
              }
            }
          };

          const handleSave = () => {
            if (selectedStartDate) {
              const locale = language === "en" ? "en" : "sr";

              if (
                selectedEndDate &&
                !isSameDay(selectedStartDate, selectedEndDate)
              ) {
                // Range
                setSelectedDateRange(
                  `${formatAppDate(selectedStartDate, locale)} - ${formatAppDate(selectedEndDate, locale)}`,
                );
              } else {
                // Single date
                setSelectedDateRange(formatAppDate(selectedStartDate, locale));
              }
              setIsDatePickerOpen(false);
            }
          };

          const handleClear = () => {
            setSelectedStartDate(null);
            setSelectedEndDate(null);
            setSelectedDateRange("");
          };

          const handleToday = () => {
            const today = new Date();
            setSelectedStartDate(today);
            setSelectedEndDate(null);
            setCurrentMonth(today);
          };

          const previousMonth = () => {
            setCurrentMonth(
              new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1),
            );
          };

          const nextMonth = () => {
            setCurrentMonth(
              new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1),
            );
          };

          const daysInMonth = getDaysInMonth(currentMonth);
          const firstDay = getFirstDayOfMonth(currentMonth);
          const days = [];

          // Empty cells for days before month starts
          for (let i = 0; i < firstDay; i++) {
            days.push(<div key={`empty-${i}`} />);
          }

          // Actual days
          for (let day = 1; day <= daysInMonth; day++) {
            const date = new Date(
              currentMonth.getFullYear(),
              currentMonth.getMonth(),
              day,
            );
            const isSelected = isStartOrEnd(date);
            const isInRangeDate = isInRange(date);
            const isToday = isSameDay(date, new Date());

            days.push(
              <button
                key={day}
                onClick={() => handleDateClick(date)}
                onMouseEnter={() => setHoverDate(date)}
                onMouseLeave={() => setHoverDate(null)}
                className="aspect-square flex items-center justify-center rounded-lg transition-all relative"
                style={{
                  background: isSelected
                    ? "#0E3DC5"
                    : isInRangeDate
                      ? "rgba(14, 61, 197, 0.1)"
                      : "transparent",
                  color: isSelected ? "white" : "#1a1a1a",
                  fontWeight: isSelected || isToday ? 600 : 400,
                  border: isToday && !isSelected ? "2px solid #0E3DC5" : "none",
                  cursor: "pointer",
                }}
              >
                {day}
              </button>,
            );
          }

          const monthName = currentMonth.toLocaleDateString(
            language === "sr" ? "sr-Latn-RS" : "en-US",
            {
              month: "long",
              year: "numeric",
            },
          );

          const weekDays =
            language === "sr"
              ? ["Pon", "Uto", "Sri", "Čet", "Pet", "Sub", "Ned"]
              : ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

          return (
            <div
              className="fixed inset-0 flex items-center justify-center z-50"
              onClick={() => setIsDatePickerOpen(false)}
              style={{
                padding: "20px",
                background: "rgba(0, 0, 0, 0.65)",
              }}
            >
              <div
                className="rounded-2xl shadow-2xl w-full max-w-md overflow-hidden relative bg-white"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Close Button */}
                <button
                  onClick={() => setIsDatePickerOpen(false)}
                  className="absolute top-4 right-4 p-2 hover:bg-gray-100 rounded-full transition-colors z-10"
                  style={{
                    border: "none",
                    background: "transparent",
                    cursor: "pointer",
                  }}
                >
                  <X size={20} style={{ color: "#1a1a1a" }} />
                </button>

                {/* Content */}
                <div className="px-6 py-6">
                  {/* Title */}
                  <h2
                    className="text-center text-xl font-bold mb-6"
                    style={{
                      color: "#1a1a1a",
                      textShadow: "0 2px 4px rgba(0, 0, 0, 0.1)",
                    }}
                  >
                    {language === "sr" ? "Izaberi datum" : "Pick Date"}
                  </h2>

                  {/* Month Navigation */}
                  <div className="flex items-center justify-between mb-6">
                    <button
                      onClick={previousMonth}
                      className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                      style={{
                        border: "none",
                        background: "transparent",
                        cursor: "pointer",
                      }}
                    >
                      <ChevronDown
                        size={20}
                        style={{
                          transform: "rotate(90deg)",
                          color: "#0E3DC5",
                        }}
                      />
                    </button>
                    <div
                      className="font-semibold capitalize"
                      style={{
                        color: "#1a1a1a",
                        fontSize: "16px",
                      }}
                    >
                      {monthName}
                    </div>
                    <button
                      onClick={nextMonth}
                      className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                      style={{
                        border: "none",
                        background: "transparent",
                        cursor: "pointer",
                      }}
                    >
                      <ChevronDown
                        size={20}
                        style={{
                          transform: "rotate(-90deg)",
                          color: "#0E3DC5",
                        }}
                      />
                    </button>
                  </div>

                  {/* Calendar Grid */}
                  <div className="mb-6">
                    {/* Week days header */}
                    <div className="grid grid-cols-7 gap-2 mb-2">
                      {weekDays.map((day) => (
                        <div
                          key={day}
                          className="text-center font-medium text-xs"
                          style={{ color: "#6B7280" }}
                        >
                          {day}
                        </div>
                      ))}
                    </div>
                    {/* Days grid */}
                    <div className="grid grid-cols-7 gap-2">{days}</div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-3">
                    <button
                      onClick={handleClear}
                      className="flex-1 px-4 py-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                      style={{
                        fontSize: "15px",
                        fontWeight: 500,
                        color: "#6B7280",
                      }}
                    >
                      {language === "sr" ? "Očisti" : "Clear"}
                    </button>
                    <button
                      onClick={handleSave}
                      className="flex-1 px-4 py-3 rounded-lg transition-all"
                      style={{
                        fontSize: "15px",
                        fontWeight: 500,
                        color: "white",
                        background: selectedStartDate ? "#0E3DC5" : "#9CA3AF",
                        border: "none",
                        cursor: selectedStartDate ? "pointer" : "not-allowed",
                      }}
                      disabled={!selectedStartDate}
                    >
                      {language === "sr" ? "Sačuvaj" : "Save"}
                    </button>
                    <button
                      onClick={handleToday}
                      className="flex-1 px-4 py-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                      style={{
                        fontSize: "15px",
                        fontWeight: 500,
                        color: "#0E3DC5",
                      }}
                    >
                      {language === "sr" ? "Danas" : "Today"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })()}
    </div>
  );
}
