import { useState, useEffect, useMemo } from "react";
import { Calendar, MapPin, Clock, Heart, CalendarDays } from "lucide-react";
import { Link } from "react-router";
import { useT } from "../hooks/useT";
import { useLanguage } from "../contexts/LanguageContext";
import { useLocation } from "../contexts/LocationContext";
import { SectionEmptyState } from "../components/SectionEmptyState";
import { RevealOnScrollArticle } from "../components/RevealOnScrollArticle";
import * as eventService from "../utils/eventService";
import { Item } from "../utils/dataService";
import eventsHeroImage from "../assets/events-hero.png";
import {
  EVENTS_CATEGORY_THEME,
  EVENTS_HERO_OVERLAY_GRADIENT,
} from "../utils/categoryThemes";
import { getTopLevelPageCategory } from "../utils/eventPageCategory";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import { DOC_TITLE_EVENTS, listingDocumentTitle } from "../utils/documentTitle";

const MONTH_NAMES_SR = [
  "Januar",
  "Februar",
  "Mart",
  "April",
  "Maj",
  "Jun",
  "Jul",
  "Avgust",
  "Septembar",
  "Oktobar",
  "Novembar",
  "Decembar",
];

const MONTH_NAMES_EN = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export function EventsAllPage() {
  const { t } = useT();
  const { language } = useLanguage();
  const { selectedCity } = useLocation();

  const [events, setEvents] = useState<Item[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [interestCounts, setInterestCounts] = useState<Record<string, number>>(
    {},
  );
  const [visibleByMonth, setVisibleByMonth] = useState<Record<string, number>>(
    {},
  );
  const INITIAL_VISIBLE_PER_MONTH = 6;
  const LOAD_MORE_STEP = 6;

  useEffect(() => {
    async function fetchEvents() {
      setIsLoading(true);
      try {
        const fetchedEvents = await eventService.getEvents("all", selectedCity);

        const now = new Date();
        const activeEvents = fetchedEvents
          .filter((event) => {
            if (!event.start_at) return false;
            const endDate = event.end_at
              ? new Date(event.end_at)
              : new Date(event.start_at);
            return endDate >= now;
          })
          .filter((e) => getTopLevelPageCategory(e) === "events")
          .sort((a, b) => {
            const dateA = a.start_at ? new Date(a.start_at).getTime() : 0;
            const dateB = b.start_at ? new Date(b.start_at).getTime() : 0;
            return dateA - dateB;
          });

        setEvents(activeEvents);

        const freeIds = activeEvents
          .filter((e) => /^(free|besplatn|gratis)/i.test(e.price || ""))
          .map((e) => e.id);
        if (freeIds.length > 0) {
          const counts = await eventService.batchGetInterestCounts(freeIds);
          setInterestCounts(counts);
        }
      } catch (err) {
        console.error("❌ EventsAllPage: Error fetching events:", err);
      }
      setIsLoading(false);
    }
    fetchEvents();
  }, [selectedCity]);

  const eventsAllTitle = useMemo(
    () => listingDocumentTitle(DOC_TITLE_EVENTS, selectedCity),
    [selectedCity],
  );
  useDocumentTitle(eventsAllTitle);

  const groupedByMonth = useMemo(() => {
    const grouped: Record<string, Item[]> = {};
    const monthOrder: string[] = [];

    events.forEach((event) => {
      if (!event.start_at) return;
      const date = new Date(event.start_at);
      const key = `${date.getFullYear()}-${String(date.getMonth()).padStart(2, "0")}`;
      if (!grouped[key]) {
        grouped[key] = [];
        monthOrder.push(key);
      }
      grouped[key].push(event);
    });

    return { grouped, monthOrder };
  }, [events]);

  return (
    <div style={{ background: "#FFFFFF", minHeight: "100vh" }}>
      {/* Hero Section */}
      <section
        className="relative w-full min-h-[320px]"
        style={{ height: "420px", marginTop: 0 }}
      >
        <img
          src={eventsHeroImage}
          alt="Dešavanja u Banjaluci"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div
          className="absolute inset-0"
          style={{ background: EVENTS_HERO_OVERLAY_GRADIENT }}
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
            {language === "sr" ? "Sva dešavanja" : "All Events"}
          </h1>
          <p
            className="text-center"
            style={{
              fontSize: "18px",
              color: "#FFFFFF",
              textShadow:
                "0 0 15px rgba(255,255,255,0.7), 0 0 25px rgba(255,255,255,0.5), 2px 2px 8px rgba(0,0,0,0.9)",
              maxWidth: "600px",
            }}
          >
            {language === "sr"
              ? "Kompletna lista svih događaja u Banjoj Luci"
              : "Complete list of all events in Banja Luka"}
          </p>
        </div>
      </section>

      {/* Main Content */}
      <div className="w-[60vw] mx-auto px-8 py-12">
        {/* Loading */}
        {isLoading && (
          <div className="text-center py-12">
            <p className="text-lg" style={{ color: "#6B7280" }}>
              {language === "sr" ? "Učitavanje..." : "Loading..."}
            </p>
          </div>
        )}

        {/* Empty */}
        {!isLoading && events.length === 0 && (
          <SectionEmptyState
            icon={CalendarDays}
            accentColor={EVENTS_CATEGORY_THEME.accentColor}
            message={language === "sr" ? "Trenutno nema sadržaja u ovoj sekciji." : "There is currently no content in this section."}
          />
        )}

        {/* Events Grouped by Month */}
        {!isLoading && events.length > 0 && (
          <>
            <div className="mb-6">
              <p className="text-sm" style={{ color: "#6B7280" }}>
                {language === "sr"
                  ? `Pronađeno ${events.length} događaja`
                  : `Found ${events.length} events`}
              </p>
            </div>

            {groupedByMonth.monthOrder.map((monthKey) => {
              const monthEvents = groupedByMonth.grouped[monthKey];
              const visibleCount =
                visibleByMonth[monthKey] ?? INITIAL_VISIBLE_PER_MONTH;
              const visibleEvents = monthEvents.slice(0, visibleCount);
              const hiddenCount = Math.max(monthEvents.length - visibleCount, 0);
              const hasMore = hiddenCount > 0;
              const [yearStr, monthStr] = monthKey.split("-");
              const monthIndex = parseInt(monthStr, 10);
              const year = parseInt(yearStr, 10);
              const currentYear = new Date().getFullYear();
              const monthName =
                language === "sr"
                  ? MONTH_NAMES_SR[monthIndex]
                  : MONTH_NAMES_EN[monthIndex];
              const monthLabel =
                year === currentYear ? monthName : `${monthName} ${year}`;

              return (
                <div key={monthKey} className="mb-8">
                  <div className="flex items-center gap-3 mb-4 w-full">
                    <div
                      className="flex items-center gap-2 px-4 py-2 rounded-xl"
                      style={{
                        background: `linear-gradient(135deg, ${EVENTS_CATEGORY_THEME.accentColor} 0%, ${EVENTS_CATEGORY_THEME.accentColor}CC 100%)`,
                      }}
                    >
                      <Calendar size={18} style={{ color: "#FFFFFF" }} />
                      <span
                        style={{
                          fontSize: "18px",
                          fontWeight: 700,
                          color: "#FFFFFF",
                          letterSpacing: "0.3px",
                        }}
                      >
                        {monthLabel}
                      </span>
                    </div>
                    <div className="flex-1 h-px" style={{ background: "#E5E7EB" }} />
                    <span
                      className="text-xs font-medium px-2 py-1 rounded-full"
                      style={{
                        background: "#FFF7ED",
                        color: EVENTS_CATEGORY_THEME.accentColor,
                        border: "1px solid #FDBA74",
                      }}
                    >
                      {monthEvents.length} {language === "sr" ? "događaja" : "events"}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {visibleEvents.map((event) => (
                      <RevealOnScrollArticle key={event.id}>
                        <Link
                          to={`/events/${event.id}`}
                          className="cursor-pointer hover:scale-[1.02] transition-all duration-300 block"
                          style={{ textDecoration: "none" }}
                        >
                          <img
                            src={
                              event.image ||
                              "https://images.unsplash.com/photo-1540039155733-5bb30b53aa14?w=800"
                            }
                            alt={event.title}
                            className="w-full h-[200px] object-cover rounded-lg"
                          />
                          <div className="p-4">
                            <div className="flex items-center gap-2 mb-2 flex-wrap">
                              <span
                                className="text-sm font-medium"
                                style={{ color: EVENTS_CATEGORY_THEME.accentColor }}
                              >
                                {eventService.translateEventType(
                                  event.event_type || event.page_slug || "",
                                  language,
                                ) || (language === "sr" ? "Događaj" : "Event")}
                              </span>
                              {/^(free|besplatn|gratis)/i.test(event.price || "") && (
                                <span
                                  className="text-xs font-medium px-2 py-1 rounded"
                                  style={{ background: "#F3F4F6", color: "#6B7280" }}
                                >
                                  {language === "sr"
                                    ? "Besplatan ulaz"
                                    : "Free Entry"}
                                </span>
                              )}
                            </div>
                            <h3
                              className="text-base font-semibold mb-2 line-clamp-2"
                              style={{ color: "#1a1a1a" }}
                            >
                              {language === "sr"
                                ? event.title
                                : event.title_en || event.title}
                            </h3>
                            {event.start_at && (
                              <>
                                <div className="flex items-center gap-2 mb-1">
                                  <Calendar size={14} style={{ color: "#6B7280" }} />
                                  <span className="text-sm" style={{ color: "#6B7280" }}>
                                    {eventService.getRelativeDateLabel(
                                      event.start_at,
                                      language,
                                    )}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2 mb-1">
                                  <Clock size={14} style={{ color: "#6B7280" }} />
                                  <span className="text-sm" style={{ color: "#6B7280" }}>
                                    {eventService.formatEventTime(
                                      event.start_at,
                                      event.end_at,
                                      language === "en" ? "en" : "sr",
                                    )}
                                  </span>
                                </div>
                              </>
                            )}
                            {(event.venue_name || event.address) && (
                              <div className="flex items-center gap-2">
                                <MapPin size={14} style={{ color: "#6B7280" }} />
                                <span className="text-sm" style={{ color: "#6B7280" }}>
                                  {event.venue_name || event.address}
                                </span>
                              </div>
                            )}
                            {interestCounts[event.id] > 0 && (
                              <div className="flex items-center gap-1.5 mt-1">
                                <Heart
                                  size={12}
                                  style={{ color: EVENTS_CATEGORY_THEME.accentColor }}
                                />
                                <span className="text-xs" style={{ color: "#9CA3AF" }}>
                                  {interestCounts[event.id]}{" "}
                                  {language === "sr" ? "zainteresovano" : "interested"}
                                </span>
                              </div>
                            )}
                          </div>
                        </Link>
                      </RevealOnScrollArticle>
                    ))}
                  </div>

                  {hasMore && (
                    <div className="flex justify-center mt-6">
                      <button
                        onClick={() =>
                          setVisibleByMonth((prev) => ({
                            ...prev,
                            [monthKey]:
                              (prev[monthKey] ?? INITIAL_VISIBLE_PER_MONTH) +
                              LOAD_MORE_STEP,
                          }))
                        }
                        className="px-6 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ease-out hover:scale-105 hover:shadow-md hover:bg-orange-50 active:scale-95"
                        style={{
                          background: "transparent",
                          color: EVENTS_CATEGORY_THEME.accentColor,
                          border: `2px solid ${EVENTS_CATEGORY_THEME.accentColor}`,
                          cursor: "pointer",
                        }}
                      >
                        {language === "sr"
                          ? `Učitaj još ${hiddenCount}`
                          : `Load ${hiddenCount} more`}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}
