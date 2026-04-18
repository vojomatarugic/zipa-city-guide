import { useState, useEffect, useMemo, useRef } from "react";
import {
  MapPin,
  ChevronDown,
  X,
  Calendar,
  Star,
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
import { getTopLevelPageCategory } from "../utils/eventPageCategory";
import {
  getWebSiteSchema,
  getTouristDestinationSchema,
  getBreadcrumbSchema,
} from "../utils/structuredData";
import { BannerAd, useBannerExists } from "../components/BannerAd";
import { SquareBannersGrid } from "../components/SquareBannersGrid";
import { VenueOpeningHoursRow } from "../components/VenueOpeningHoursRow";
import { SocialProofGallery } from "../components/SocialProofGallery";
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
import kastelHeroImage from "../assets/2cc3b226c8687491df7c5255c57428c1428bdda2.png";
import ogImage from "../assets/ae3d44fbb2bace1359cf1d0dcf503ab46d8abef2.png";
import cityModalBg from "../assets/4e00219e8da31038f51e64d45285bbc6d7f6feaa.png";
import newCityModalBg from "../assets/6723694754a898f8b40bab31482fee544e9de39b.png";
import ljubljanaImage from "../assets/88e6138cbdfd83a22058e515ab20d1b1e81b3339.png";
import budvaImage from "../assets/38b2c0160b51bb71bbc5aa949db36fce790aea66.png";
import zagrebImage from "../assets/c2759ad9780a7a7c464fab48ab3c02fee98aabfb.png";
import beogradImage from "../assets/2e147443589cb70f6ea595a9e31d0bb9ea9d0b87.png";
import heroBackgroundImage from "/public/images/hero-home-page.png";
import eventCardBg from "../assets/89bb26cd8326bce9428238434c0c748f29da8ece.png";
import newEventCardBg from "../assets/b4eb92f2d8dabb323b7bbcfe325643ecf2317bad.png";
import latestEventCardBg from "../assets/d3b7ae5072e14ac7566a2b3ff69d9798aefa4aa5.png";
import prijedorImage from "../assets/c7afefcd8762b783ba717a12d11d33354bcf1e87.png";
import gradiskaImage from "../assets/02d44d6e71c7267460c0dec18253b52390e1308d.png";
import dobojImage from "../assets/1b0369b9bc57e5aa1705649d8994d738e67bdc1a.png";

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
  const [featuredEvents, setFeaturedEvents] = useState<any[]>([]);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [searchResults, setSearchResults] = useState<any[]>([]); // ✅ NEW: Search results
  const [searchLoading, setSearchLoading] = useState(false); // ✅ NEW: Search loading state
  const [interestCounts, setInterestCounts] = useState<Record<string, number>>(
    {},
  );
  const searchShellRef = useRef<HTMLDivElement>(null);

  // Same bucket as EventsPage: top-level category "events" only
  useEffect(() => {
    async function fetchFeaturedEvents() {
      setEventsLoading(true);
      const events = await eventService.getEvents("upcoming", selectedCity);
      const eventsBucket = events.filter(
        (e) => getTopLevelPageCategory(e) === "events",
      );
      const top = eventsBucket.slice(0, 4);
      setFeaturedEvents(top);
      setEventsLoading(false);

      const freeEventIds = top
        .filter((e) => /^(free|besplatn|gratis)/i.test(e.price || ""))
        .map((e) => e.id);
      if (freeEventIds.length > 0) {
        const counts = await eventService.batchGetInterestCounts(freeEventIds);
        setInterestCounts(counts);
      }
    }
    fetchFeaturedEvents();
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

  // Nearby cities mapping - shows cities near the selected city
  const nearbyCitiesMap: Record<
    string,
    Array<{ city: string; events: string }>
  > = {
    "Banja Luka": [
      { city: "Prijedor", events: "5+" },
      { city: "Gradiška", events: "3+" },
      { city: "Prnjavor", events: "2+" },
      { city: "Doboj", events: "4+" },
    ],
    Sarajevo: [
      { city: "Zenica", events: "7+" },
      { city: "Mostar", events: "5+" },
      { city: "Tuzla", events: "2+" },
      { city: "Brčko", events: "1+" },
    ],
    Tuzla: [
      { city: "Sarajevo", events: "29+" },
      { city: "Brčko", events: "1+" },
      { city: "Doboj", events: "4+" },
      { city: "Zenica", events: "7+" },
    ],
    Zenica: [
      { city: "Sarajevo", events: "29+" },
      { city: "Mostar", events: "5+" },
      { city: "Tuzla", events: "2+" },
      { city: "Doboj", events: "4+" },
    ],
    Mostar: [
      { city: "Sarajevo", events: "29+" },
      { city: "Trebinje", events: "3+" },
      { city: "Zenica", events: "7+" },
      { city: "Bihać", events: "1+" },
    ],
    Bihać: [
      { city: "Banja Luka", events: "16+" },
      { city: "Prijedor", events: "5+" },
      { city: "Gradiška", events: "3+" },
      { city: "Sarajevo", events: "29+" },
    ],
    Brčko: [
      { city: "Tuzla", events: "2+" },
      { city: "Doboj", events: "4+" },
      { city: "Sarajevo", events: "29+" },
      { city: "Banja Luka", events: "16+" },
    ],
    Trebinje: [
      { city: "Mostar", events: "5+" },
      { city: "Sarajevo", events: "29+" },
      { city: "Banja Luka", events: "16+" },
      { city: "Zenica", events: "7+" },
    ],
    Prijedor: [
      { city: "Banja Luka", events: "16+" },
      { city: "Gradiška", events: "3+" },
      { city: "Bihać", events: "1+" },
      { city: "Doboj", events: "4+" },
    ],
    Gradiška: [
      { city: "Banja Luka", events: "16+" },
      { city: "Prijedor", events: "5+" },
      { city: "Prnjavor", events: "2+" },
      { city: "Doboj", events: "4+" },
    ],
    Prnjavor: [
      { city: "Banja Luka", events: "16+" },
      { city: "Doboj", events: "4+" },
      { city: "Gradiška", events: "3+" },
      { city: "Prijedor", events: "5+" },
    ],
    Doboj: [
      { city: "Banja Luka", events: "16+" },
      { city: "Prnjavor", events: "2+" },
      { city: "Tuzla", events: "2+" },
      { city: "Zenica", events: "7+" },
    ],
  };

  // Get nearby cities for selected city
  const getNearbyCities = () => {
    return nearbyCitiesMap[selectedCity] || nearbyCitiesMap["Banja Luka"];
  };

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
    canonical: "https://blcityguide.com/",
    structuredData: {
      "@context": "https://schema.org",
      "@graph": [
        getWebSiteSchema(),
        getTouristDestinationSchema(),
        getBreadcrumbSchema([
          { name: t("home"), url: "https://blcityguide.com/" },
        ]),
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
                <Calendar size={18} style={{ color: "#0E3DC5" }} />
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
              <MapPin size={18} style={{ color: "#0E3DC5" }} />
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
                            to={`/events/${event.id}`}
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
                                    <Calendar size={12} />
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
          {eventsLoading && (
            <div className="text-center py-12">
              <p className="text-lg" style={{ color: "#6B7280" }}>
                {language === "sr"
                  ? "Učitavanje događaja..."
                  : "Loading events..."}
              </p>
            </div>
          )}

          {/* Empty State */}
          {!eventsLoading && featuredEvents.length === 0 && (
            <div className="text-center py-12">
              <Calendar
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
          {!eventsLoading && featuredEvents.length > 0 && (
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
                  <Link
                    key={event.id}
                    to={`/events/${event.id}`}
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
                            <Calendar size={14} style={{ color: "#6B7280" }} />
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
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* EXPLORE CITIES - FULL WIDTH WITH GRADIENT */}
      <section
        className="py-12 overflow-hidden"
        style={{
          background: "#FFFFFF",
        }}
      >
        <div className="w-[60vw] mx-auto">
          <h2
            className="text-left"
            style={{
              fontSize: "24px",
              fontWeight: 600,
              marginBottom: "24px",
              textShadow: "0 2px 4px rgba(0, 0, 0, 0.1)",
            }}
          >
            {t("exploreCities")}
          </h2>

          {/*
            VAŽNO: Ova sekcija prikazuje TAČNO 3 FEATURED GRADA
            NE DODAVATI NOVE GRADOVE OVDJE!
            Nova dešavanja koja korisnici prijavljuju kroz Submit Event formu
            treba da se prikazuju samo na /events/all stranici.
          */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              {
                city: "Prijedor",
                events: "5+",
                image: prijedorImage,
              },
              {
                city: "Gradiška",
                events: "3+",
                image: gradiskaImage,
              },
              {
                city: "Doboj",
                events: "4+",
                image: dobojImage,
              },
            ]
              .slice(0, 3)
              .map((item, i) => (
                <div
                  key={i}
                  className="rounded-md overflow-hidden cursor-pointer hover:scale-[1.02] transition-all duration-300 border border-gray-100 relative"
                  style={{ height: "200px" }}
                >
                  {/* Image - pozadina */}
                  <img
                    src={item.image}
                    alt={item.city}
                    className="absolute inset-0 w-full h-full object-cover"
                  />

                  {/* Gradient overlay */}
                  <div
                    className="absolute inset-0"
                    style={{
                      background:
                        "linear-gradient(to top, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0) 60%)",
                    }}
                  />

                  {/* Content PREKO SLIKE */}
                  <div className="absolute bottom-0 left-0 right-0 p-4">
                    {/* Title */}
                    <div
                      className="font-semibold mb-1"
                      style={{
                        fontSize: "18px",
                        color: "white",
                      }}
                    >
                      {item.city}
                    </div>

                    {/* Events count */}
                    <div
                      className="text-sm"
                      style={{
                        color: "rgba(255, 255, 255, 0.9)",
                      }}
                    >
                      {item.events} {t("events")}
                    </div>
                  </div>
                </div>
              ))}
          </div>
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
            {[
              {
                image:
                  "https://images.unsplash.com/photo-1767979212124-bf08504f5dae?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx0aGVhdHJlJTIwc3RhZ2UlMjBwZXJmb3JtYW5jZSUyMGRyYW1hfGVufDF8fHx8MTc2OTUxNDMzOHww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
                category: language === "sr" ? "Drama" : "Drama",
                freeEntry: false,
                title: language === "sr" ? "Hamlet" : "Hamlet",
                date:
                  language === "sr"
                    ? "Utorak, 4. feb • 19:00"
                    : "Tuesday, Feb 4 • 19:00",
                venue:
                  language === "sr" ? "Narodno pozorište" : "National Theatre",
              },
              {
                image:
                  "https://images.unsplash.com/photo-1579625676445-469eed0fa554?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxvcGVyYSUyMHRoZWF0cmUlMjBjdXJ0YWluJTIwc3RhZ2V8ZW58MXx8fHwxNzY5NTE0MzM5fDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
                category: language === "sr" ? "Opera" : "Opera",
                freeEntry: false,
                title: language === "sr" ? "La Traviata" : "La Traviata",
                date:
                  language === "sr"
                    ? "Petak, 7. feb • 20:00"
                    : "Friday, Feb 7 • 20:00",
                venue:
                  language === "sr" ? "Narodno pozorište" : "National Theatre",
              },
              {
                image:
                  "https://images.unsplash.com/photo-1758670331763-b0f3cd7c1a8d?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxiYWxsZXQlMjBkYW5jZSUyMHBlcmZvcm1hbmNlJTIwc3RhZ2V8ZW58MXx8fHwxNzY5NTE0MzM5fDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
                category: language === "sr" ? "Balet" : "Ballet",
                freeEntry: false,
                title: language === "sr" ? "Labuđe jezero" : "Swan Lake",
                date:
                  language === "sr"
                    ? "Subota, 8. feb • 19:30"
                    : "Saturday, Feb 8 • 19:30",
                venue:
                  language === "sr" ? "Kulturni centar" : "Cultural Center",
              },
            ]
              .slice(0, 3)
              .map((show, i) => (
                <div
                  key={i}
                  className="cursor-pointer hover:scale-[1.02] transition-all duration-300"
                >
                  <Link
                    to="/theatre"
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
                          {show.category}
                        </span>
                        {show.freeEntry && (
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
                        {show.title}
                      </h3>

                      {/* Date */}
                      <div className="flex items-center gap-2 mb-1">
                        <Calendar size={14} style={{ color: "#6B7280" }} />
                        <span className="text-sm" style={{ color: "#6B7280" }}>
                          {show.date}
                        </span>
                      </div>

                      {/* Venue */}
                      <div className="flex items-center gap-2">
                        <MapPin size={14} style={{ color: "#6B7280" }} />
                        <span className="text-sm" style={{ color: "#6B7280" }}>
                          {show.venue}
                        </span>
                      </div>
                    </div>
                  </Link>
                </div>
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
            {[
              {
                image:
                  "https://images.unsplash.com/photo-1688678004647-945d5aaf91c1?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjaW5lbWElMjBtb3ZpZSUyMHRoZWF0cmUlMjBzY3JlZW58ZW58MXx8fHwxNzY5NTE0MzQyfDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
                category: language === "sr" ? "Akcija" : "Action",
                title:
                  language === "sr"
                    ? "Mission: Impossible 8"
                    : "Mission: Impossible 8",
                rating: "8.5/10",
                date:
                  language === "sr"
                    ? "Svaki dan • 18:00 & 21:00"
                    : "Daily • 18:00 & 21:00",
                venue: "Cineplexx",
              },
              {
                image:
                  "https://images.unsplash.com/photo-1760170437237-a3654545ab4c?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtb3ZpZSUyMHRoZWF0ZXIlMjBzZWF0cyUyMGF1ZGllbmNlfGVufDF8fHx8MTc2OTUxNDM0Mnww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
                category: language === "sr" ? "Triler" : "Thriller",
                title: language === "sr" ? "Oppenheimer" : "Oppenheimer",
                rating: "9.2/10",
                date: language === "sr" ? "Svaki dan • 19:30" : "Daily • 19:30",
                venue: "Palas Mall",
              },
              {
                image:
                  "https://images.unsplash.com/photo-1728771227328-7cc2a0dc253a?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxmaWxtJTIwcHJvamVjdG9yJTIwY2luZW1hfGVufDF8fHx8MTc2OTUxNDM0Mnww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
                category: language === "sr" ? "Drama" : "Drama",
                title:
                  language === "sr"
                    ? "Killers of the Flower Moon"
                    : "Killers of the Flower Moon",
                rating: "8.8/10",
                date: language === "sr" ? "Svaki dan • 20:15" : "Daily • 20:15",
                venue: "Cineplexx",
              },
              {
                image:
                  "https://images.unsplash.com/photo-1768582870566-d1ea815a7545?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjaW5lbWElMjBwb3Bjb3JuJTIwbW92aWUlMjBuaWdodHxlbnwxfHx8fDE3Njk1MTQzNDN8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
                category: language === "sr" ? "Komedija" : "Comedy",
                title: language === "sr" ? "Barbie" : "Barbie",
                rating: "7.9/10",
                date: language === "sr" ? "Svaki dan • 17:00" : "Daily • 17:00",
                venue: "Palas Mall",
              },
              {
                image:
                  "https://images.unsplash.com/photo-1762417420551-2fec32ed3595?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtb3ZpZSUyMHByZW1pZXJlJTIwY2luZW1hfGVufDF8fHx8MTc2OTUxNDM0NHww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
                category: language === "sr" ? "Sci-Fi" : "Sci-Fi",
                title: language === "sr" ? "Dune: Part Two" : "Dune: Part Two",
                rating: "9.0/10",
                date: language === "sr" ? "Svaki dan • 19:00" : "Daily • 19:00",
                venue: "Cineplexx",
              },
            ]
              .slice(0, 5)
              .map((movie, i) => (
                <div
                  key={i}
                  className="cursor-pointer hover:scale-[1.02] transition-all duration-300"
                >
                  <Link
                    to="/cinema"
                    style={{
                      textDecoration: "none",
                      color: "inherit",
                      display: "block",
                    }}
                  >
                    {/* Image */}
                    <img
                      src={movie.image}
                      alt={movie.title}
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
                          {movie.category}
                        </span>
                        <span
                          className="text-xs font-medium px-2 py-1 rounded flex items-center gap-1"
                          style={{
                            background: BACKGROUNDS.lightYellow,
                            color: UTILITY.yellow,
                          }}
                        >
                          <Star size={12} fill={UTILITY.yellow} />
                          {movie.rating}
                        </span>
                      </div>

                      {/* Title */}
                      <h3
                        className="text-base font-semibold mb-2"
                        style={{ color: "#1a1a1a" }}
                      >
                        {movie.title}
                      </h3>

                      {/* Date */}
                      <div className="flex items-center gap-2 mb-1">
                        <Calendar size={14} style={{ color: "#6B7280" }} />
                        <span className="text-sm" style={{ color: "#6B7280" }}>
                          {movie.date}
                        </span>
                      </div>

                      {/* Venue */}
                      <div className="flex items-center gap-2">
                        <MapPin size={14} style={{ color: "#6B7280" }} />
                        <span className="text-sm" style={{ color: "#6B7280" }}>
                          {movie.venue}
                        </span>
                      </div>
                    </div>
                  </Link>
                </div>
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
              ...getGradientTextStyle(GRADIENTS.restaurants),
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
            Novi restorani treba da se prikazuju samo na /restaurants/all stranici.
          */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              {
                image:
                  "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxyZXN0YXVyYW50JTIwaW50ZXJpb3IlMjBkaW5pbmd8ZW58MXx8fHwxNzM4MTU4NDAwfDA&ixlib=rb-4.1.0&q=80&w=1080",
                category:
                  language === "sr" ? "Lokalna kuhinja" : "Local Cuisine",
                priceRange: "€€€",
                title: language === "sr" ? "Lunch Bar Ara" : "Lunch Bar Ara",
                location: language === "sr" ? "Centar grada" : "City Center",
                hours:
                  language === "sr"
                    ? "Pon-Sub: 08:00 - 23:00"
                    : "Mon-Sat: 08:00 - 23:00",
              },
              {
                image:
                  "https://images.unsplash.com/photo-1552566626-52f8b828add9?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxyZXN0YXVyYW50JTIwZ3JpbGwlMjBtZWF0fGVufDF8fHx8MTczODE1ODQwMHww&ixlib=rb-4.1.0&q=80&w=1080",
                category: language === "sr" ? "Roštilj" : "Grill",
                priceRange: "€€",
                title: language === "sr" ? "Staro Bure" : "Staro Bure",
                location: language === "sr" ? "Nova Varoš" : "Nova Varos",
                hours:
                  language === "sr"
                    ? "Svakog dana: 12:00 - 00:00"
                    : "Every day: 12:00 - 00:00",
              },
              {
                image:
                  "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxyZXN0YXVyYW50JTIwaXRhbGljJTIwZm9vZHxlbnwxfHx8fDE3MzgxNTg0MDB8MA&ixlib=rb-4.1.0&q=80&w=1080",
                category: language === "sr" ? "Italijanska" : "Italian",
                priceRange: "€€€",
                title:
                  language === "sr" ? "Gatto Trattoria" : "Gatto Trattoria",
                location: language === "sr" ? "Centar grada" : "City Center",
                hours:
                  language === "sr"
                    ? "Uto-Ned: 11:00 - 23:00"
                    : "Tue-Sun: 11:00 - 23:00",
              },
            ]
              .slice(0, 3)
              .map((restaurant, i) => (
                <div
                  key={i}
                  className="cursor-pointer hover:scale-[1.02] transition-all duration-300"
                >
                  <Link
                    to="/food-and-drink"
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
                            color: CATEGORY_COLORS.restaurants,
                          }}
                        >
                          {restaurant.category}
                        </span>
                      </div>
                      <h3
                        className="text-base font-semibold mb-2"
                        style={{ color: "#1a1a1a" }}
                      >
                        {restaurant.title}
                      </h3>
                      <div className="flex items-center gap-2 mb-1">
                        <MapPin size={14} style={{ color: "#6B7280" }} />
                        <span className="text-sm" style={{ color: "#6B7280" }}>
                          {restaurant.location}
                        </span>
                      </div>
                      <VenueOpeningHoursRow hoursText={restaurant.hours} />
                    </div>
                  </Link>
                </div>
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
              to="/nightlife"
              style={{ textDecoration: "none", color: "inherit" }}
            >
              {language === "sr" ? "Klubovi" : "Clubs"}
            </Link>
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              {
                image:
                  "https://images.unsplash.com/photo-1625612446042-afd3fe024131?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxuaWdodGNsdWIlMjBwYXJ0eSUyMERKJTIwbGlnaHRzfGVufDF8fHx8MTc2OTUxNDM1MXww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
                category: language === "sr" ? "Noćni klub" : "Night Club",
                title: language === "sr" ? "Club Speakers" : "Club Speakers",
                type:
                  language === "sr"
                    ? "Electronic & House"
                    : "Electronic & House",
                opens: language === "sr" ? "Petak • 23:00" : "Friday • 23:00",
              },
              {
                image:
                  "https://images.unsplash.com/photo-1768054186905-cee1f184abcc?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjbHViJTIwZGFuY2UlMjBmbG9vciUyMGNyb3dkfGVufDF8fHx8MTc2OTUxNDM1MXww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
                category: language === "sr" ? "Dance Club" : "Dance Club",
                title: language === "sr" ? "Factory" : "Factory",
                type: language === "sr" ? "Techno & EDM" : "Techno & EDM",
                opens:
                  language === "sr" ? "Subota • 22:00" : "Saturday • 22:00",
              },
              {
                image:
                  "https://images.unsplash.com/photo-1558011554-b0dd73a08568?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxuaWdodGNsdWIlMjBuZW9uJTIwbGlnaHRzJTIwYmFyfGVufDF8fHx8MTc2OTUxNDM1Mnww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
                category: language === "sr" ? "Cocktail Bar" : "Cocktail Bar",
                title: language === "sr" ? "Bar Central" : "Bar Central",
                type:
                  language === "sr"
                    ? "Lounge & Cocktails"
                    : "Lounge & Cocktails",
                opens:
                  language === "sr" ? "Četvrtak • 20:00" : "Thursday • 20:00",
              },
              {
                image:
                  "https://images.unsplash.com/photo-1689200049785-abed9d7da79d?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjbHViJTIwcGFydHklMjBwZW9wbGUlMjBkYW5jaW5nfGVufDF8fHx8MTc2OTUxNDM1Mnww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
                category: language === "sr" ? "Live Music" : "Live Music",
                title:
                  language === "sr" ? "Jazz Club Kastel" : "Jazz Club Kastel",
                type:
                  language === "sr" ? "Jazz & Live Bands" : "Jazz & Live Bands",
                opens:
                  language === "sr" ? "Srijeda • 21:00" : "Wednesday • 21:00",
              },
            ].map((club, i) => (
              <div
                key={i}
                className="cursor-pointer hover:scale-[1.02] transition-all duration-300"
              >
                <Link
                  to="/nightlife"
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
                        {club.category}
                      </span>
                    </div>

                    {/* Title */}
                    <h3
                      className="text-base font-semibold mb-1"
                      style={{ color: "#1a1a1a" }}
                    >
                      {club.title}
                    </h3>

                    {/* Type */}
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm" style={{ color: "#6B7280" }}>
                        {club.type}
                      </span>
                    </div>

                    {/* Opens */}
                    <div className="flex items-center gap-2">
                      <Calendar size={14} style={{ color: "#6B7280" }} />
                      <span className="text-sm" style={{ color: "#6B7280" }}>
                        {club.opens}
                      </span>
                    </div>
                  </div>
                </Link>
              </div>
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
            {[
              {
                image:
                  "https://images.unsplash.com/photo-1566735355835-bddb43dc3f63?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxsaXZlJTIwY29uY2VydCUyMHN0YWdlJTIwcGVyZm9ybWFuY2V8ZW58MXx8fHwxNzY5NTEzNDI2fDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
                category: language === "sr" ? "Pop" : "Pop",
                freeEntry: false,
                title:
                  language === "sr"
                    ? "Željko Joksimović Live"
                    : "Zeljko Joksimovic Live",
                date:
                  language === "sr"
                    ? "Subota, 21. dec • 21:00"
                    : "Saturday, Dec 21 • 21:00",
                venue: language === "sr" ? "Borik Arena" : "Borik Arena",
              },
              {
                image:
                  "https://images.unsplash.com/photo-1709731191876-899e32264420?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxyb2NrJTIwYmFuZCUyMGNvbmNlcnQlMjBuaWdodHxlbnwxfHx8fDE3Njk1MTM0Mjl8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
                category: language === "sr" ? "Rock" : "Rock",
                freeEntry: false,
                title:
                  language === "sr"
                    ? "Divlje Jagode - Turneja 2025"
                    : "Divlje Jagode - Tour 2025",
                date:
                  language === "sr"
                    ? "Petak, 10. jan • 20:00"
                    : "Friday, Jan 10 • 20:00",
                venue: language === "sr" ? "Paraf Hall" : "Paraf Hall",
              },
              {
                image:
                  "https://images.unsplash.com/photo-1760160741479-22e894be4296?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxqYXp6JTIwbXVzaWMlMjBjb25jZXJ0JTIwcGVyZm9ybWFuY2V8ZW58MXx8fHwxNzY5NTEzNDMxfDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
                category: language === "sr" ? "Jazz" : "Jazz",
                freeEntry: true,
                title:
                  language === "sr"
                    ? "Jazz večer u Kastelu"
                    : "Jazz Night at Kastel",
                date:
                  language === "sr"
                    ? "Četvrtak, 16. jan • 19:30"
                    : "Thursday, Jan 16 • 19:30",
                venue: language === "sr" ? "Tvrđava Kastel" : "Kastel Fortress",
              },
            ].map((concert, i) => (
              <div
                key={i}
                className="cursor-pointer hover:scale-[1.02] transition-all duration-300"
              >
                <Link
                  to="/concerts"
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
                        {concert.category}
                      </span>
                      {concert.freeEntry && (
                        <span
                          className="text-xs font-medium px-2 py-1 rounded"
                          style={{
                            background: BACKGROUNDS.lightGray,
                            color: TEXT.tertiary,
                          }}
                        >
                          {language === "sr" ? "Besplatan ulaz" : "Free Entry"}
                        </span>
                      )}
                    </div>

                    {/* Title */}
                    <h3
                      className="text-base font-semibold mb-2"
                      style={{ color: "#1a1a1a" }}
                    >
                      {concert.title}
                    </h3>

                    {/* Date */}
                    <div className="flex items-center gap-2 mb-1">
                      <Calendar size={14} style={{ color: "#6B7280" }} />
                      <span className="text-sm" style={{ color: "#6B7280" }}>
                        {concert.date}
                      </span>
                    </div>

                    {/* Venue */}
                    <div className="flex items-center gap-2">
                      <MapPin size={14} style={{ color: "#6B7280" }} />
                      <span className="text-sm" style={{ color: "#6B7280" }}>
                        {concert.venue}
                      </span>
                    </div>
                  </div>
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SOCIAL PROOF GALLERY */}
      <SocialProofGallery language={language} />

      {/* EXPLORE REGIONAL CITIES - FULL WIDTH BACKGROUND */}
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
            {t("exploreRegionalCities")}
          </h2>

          {/*
            VAŽNO: Ova sekcija prikazuje SVE 4 FEATURED GRADA
            NE DODAVATI NOVE GRADOVE OVDJE!
            Novi gradovi treba da se prikazuju na odgovarajućim stranicama.
          */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
            {[
              {
                city: "Beograd",
                events: "20+",
                image: beogradImage,
              },
              {
                city: "Zagreb",
                events: "15+",
                image: zagrebImage,
              },
              {
                city: "Ljubljana",
                events: "12+",
                image: ljubljanaImage,
              },
              {
                city: "Budva",
                events: "10+",
                image: budvaImage,
              },
            ].map((item, i) => (
              <div
                key={i}
                className="relative rounded-md overflow-hidden cursor-pointer hover:scale-[1.02] transition-all duration-300"
                style={{ height: "160px" }}
              >
                <img
                  src={item.image}
                  alt={item.city}
                  className="w-full h-full object-cover"
                />
                <div
                  className="absolute inset-0"
                  style={{
                    background:
                      "linear-gradient(to top, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0) 60%)",
                  }}
                />
                <div className="absolute bottom-3 left-3">
                  <div
                    className="text-white font-semibold mb-1"
                    style={{ fontSize: "16px" }}
                  >
                    {item.city}
                  </div>
                  <div
                    className="text-sm"
                    style={{
                      color: "rgba(255, 255, 255, 0.9)",
                    }}
                  >
                    {item.events} {t("events")}
                  </div>
                </div>
              </div>
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
