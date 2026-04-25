import { useState, useEffect, useMemo } from "react";
import { CalendarDays, MapPin, Clock, Drama } from "lucide-react";
import { Link } from "react-router";
import { useT } from "../hooks/useT";
import { useLanguage } from "../contexts/LanguageContext";
import { useLocation } from "../contexts/LocationContext";
import { ImageWithFallback } from "../components/figma/ImageWithFallback";
import { SectionEmptyState } from "../components/SectionEmptyState";
import { RevealOnScrollArticle } from "../components/RevealOnScrollArticle";
import * as eventService from "../utils/eventService";
import { Item } from "../utils/dataService";
import {
  eventDetailPath,
  getTopLevelPageCategory,
} from "../utils/eventPageCategory";
import {
  getBadgeTextColorForPageSlug,
  LISTING_BADGE_SURFACE_CLASS,
} from "../utils/categoryThemes";
import theatreHeroImage from "../assets/theatre-hero.png";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import {
  DOC_TITLE_THEATRE,
  listingDocumentTitle,
} from "../utils/documentTitle";
import { cityEquals } from "../utils/city";

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

export function TheatreAllPage() {
  const { t } = useT();
  const { language } = useLanguage();
  const { selectedCity } = useLocation();

  const [events, setEvents] = useState<Item[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [visibleByMonth, setVisibleByMonth] = useState<Record<string, number>>(
    {},
  );
  const INITIAL_VISIBLE_PER_MONTH = 6;
  const LOAD_MORE_STEP = 6;

  useEffect(() => {
    async function fetchTheatre() {
      setIsLoading(true);
      try {
        const fetched = await eventService.getEvents("all", selectedCity);
        const now = new Date();
        const nextUpcomingSlot = (
          e: Item,
        ): { start_at: string; end_at?: string | null } | null => {
          const slots = eventService.getEventScheduleSlots(e);
          return slots.find((s) => new Date(s.start_at) >= now) ?? null;
        };
        const active = fetched
          .filter(
            (e) =>
              e.status === "approved" &&
              getTopLevelPageCategory(e) === "theatre" &&
              cityEquals(e.city, selectedCity),
          )
          .filter((e) => {
            const slots = eventService.getEventScheduleSlots(e);
            if (slots.length > 0) {
              return slots.some((s) => new Date(s.end_at || s.start_at) >= now);
            }
            if (!e.start_at) return false;
            const end = e.end_at ? new Date(e.end_at) : new Date(e.start_at);
            return end >= now;
          })
          .map((e) => {
            const next = nextUpcomingSlot(e);
            return next
              ? {
                  ...e,
                  start_at: next.start_at,
                  end_at: next.end_at ?? null,
                }
              : e;
          })
          .sort(
            (a, b) =>
              (a.start_at ? new Date(a.start_at).getTime() : 0) -
              (b.start_at ? new Date(b.start_at).getTime() : 0),
          );
        setEvents(active);
      } catch (err) {
        console.error("❌ TheatreAllPage:", err);
      }
      setIsLoading(false);
    }
    fetchTheatre();
  }, [selectedCity]);

  const theatreAllTitle = useMemo(
    () => listingDocumentTitle(DOC_TITLE_THEATRE, selectedCity),
    [selectedCity],
  );
  useDocumentTitle(theatreAllTitle);

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
      <section
        className="relative w-full min-h-[320px]"
        style={{ height: "420px", marginTop: 0 }}
      >
        <img
          src={theatreHeroImage}
          alt="Pozorište u Banjaluci"
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
              letterSpacing: "-1px",
            }}
          >
            {t("allTheatreDesc")}
          </h1>
        </div>
      </section>

      <div className="w-[60vw] mx-auto px-8 py-12">
        {isLoading && (
          <div className="text-center py-12">
            <p className="text-lg" style={{ color: "#6B7280" }}>
              {language === "sr" ? "Učitavanje..." : "Loading..."}
            </p>
          </div>
        )}

        {!isLoading && events.length === 0 && (
          <SectionEmptyState
            icon={Drama}
            accentColor="#8E24AA"
            message={language === "sr" ? "Trenutno nema sadržaja u ovoj sekciji." : "There is currently no content in this section."}
          />
        )}

        {!isLoading && events.length > 0 && (
          <>
            {groupedByMonth.monthOrder.map((monthKey) => {
              const monthEvents = groupedByMonth.grouped[monthKey];
              const visibleCount =
                visibleByMonth[monthKey] ?? INITIAL_VISIBLE_PER_MONTH;
              const visibleEvents = monthEvents.slice(0, visibleCount);
              const hiddenCount = Math.max(monthEvents.length - visibleCount, 0);
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
                        background:
                          "linear-gradient(135deg, #8E24AA 0%, rgba(142, 36, 170, 0.8) 100%)",
                      }}
                    >
                      <CalendarDays size={18} style={{ color: "#FFFFFF" }} />
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
                        background: "#F3E5F5",
                        color: "#8E24AA",
                        border: "1px solid #CE93D8",
                      }}
                    >
                      {monthEvents.length} {language === "sr" ? "predstava" : "shows"}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {visibleEvents.map((event) => (
                      <RevealOnScrollArticle key={event.id}>
                        <Link
                          to={eventDetailPath(event)}
                          className="cursor-pointer hover:scale-[1.02] transition-all duration-300 block"
                          style={{ textDecoration: "none" }}
                        >
                          <ImageWithFallback
                            src={
                              event.image ||
                              "https://images.unsplash.com/photo-1540039155733-5bb30b53aa14?w=800"
                            }
                            alt={
                              language === "en" && event.title_en
                                ? event.title_en
                                : event.title
                            }
                            className="w-full h-[200px] object-cover rounded-md"
                          />
                          <div className="p-4">
                            <div className="flex items-center gap-2 mb-2 flex-wrap">
                              <span
                                className={LISTING_BADGE_SURFACE_CLASS}
                                style={{
                                  color: getBadgeTextColorForPageSlug(
                                    getTopLevelPageCategory(event),
                                  ),
                                }}
                              >
                                {event.event_type
                                  ? eventService.translateEventType(
                                      event.event_type,
                                      language,
                                    )
                                  : language === "sr"
                                    ? "Pozorište"
                                    : "Theatre"}
                              </span>
                              {event.price && (
                                <span
                                  className={LISTING_BADGE_SURFACE_CLASS}
                                  style={{
                                    color: getBadgeTextColorForPageSlug(
                                      getTopLevelPageCategory(event),
                                    ),
                                  }}
                                >
                                  {eventService.formatPrice(event.price, language)}
                                </span>
                              )}
                            </div>
                            <h3
                              className="text-base font-semibold mb-2 line-clamp-2"
                              style={{ color: "#1a1a1a" }}
                            >
                              {language === "en" && event.title_en
                                ? event.title_en
                                : event.title}
                            </h3>
                            {event.start_at && (
                              <>
                                <div className="flex items-center gap-2 mb-1">
                                  <CalendarDays size={14} style={{ color: "#6B7280" }} />
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
                          </div>
                        </Link>
                      </RevealOnScrollArticle>
                    ))}
                  </div>

                  {hiddenCount > 0 && (
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
                          color: "#8E24AA",
                          border: "2px solid #8E24AA",
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
