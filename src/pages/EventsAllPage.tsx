import { useState, useEffect } from "react";
import {
  Calendar,
  MapPin,
  Clock,
  Heart,
  CalendarDays,
} from "lucide-react";
import { Link } from "react-router";
import { useT } from "../hooks/useT";
import { useLanguage } from "../contexts/LanguageContext";
import { useLocation } from "../contexts/LocationContext";
import { UnderConstruction } from "../components/UnderConstruction";
import { MonthAccordion } from "../components/MonthAccordion";
import * as eventService from "../utils/eventService";
import { Item } from "../utils/dataService";
import eventsHeroImage from "../assets/55c8d14367570f30de708fa478fd6a7489c658c9.png";
import { EVENTS_CATEGORY_THEME, EVENTS_HERO_OVERLAY_GRADIENT } from "../utils/categoryThemes";
import { getTopLevelPageCategory } from "../utils/eventPageCategory";

export function EventsAllPage() {
  const { t } = useT();
  const { language } = useLanguage();
  const { selectedCity } = useLocation();
  
  const [events, setEvents] = useState<Item[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [interestCounts, setInterestCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    async function fetchEvents() {
      setIsLoading(true);
      try {
        const fetchedEvents = await eventService.getEvents(
          "all",
          selectedCity
        );
        
        const now = new Date();
        const activeEvents = fetchedEvents
          .filter((event) => {
            if (!event.start_at) return false;
            const endDate = event.end_at ? new Date(event.end_at) : new Date(event.start_at);
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
          .filter(e => /^(free|besplatn|gratis)/i.test(e.price || ''))
          .map(e => e.id);
        if (freeIds.length > 0) {
          const counts = await eventService.batchGetInterestCounts(freeIds);
          setInterestCounts(counts);
        }
      } catch (err) {
        console.error('❌ EventsAllPage: Error fetching events:', err);
      }
      setIsLoading(false);
    }
    fetchEvents();
  }, [selectedCity]);

  return (
    <div style={{ background: "#FFFFFF", minHeight: "100vh" }}>
      {/* Hero Section */}
      <section
        className="relative w-full"
        style={{ height: "250px", marginTop: 0 }}
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
              textShadow: "0 0 20px rgba(255,255,255,0.8), 0 0 30px rgba(255,255,255,0.6), 3px 3px 10px rgba(0,0,0,0.9)",
            }}
          >
            {language === "sr" ? "Sva dešavanja" : "All Events"}
          </h1>
          <p
            className="text-center"
            style={{
              fontSize: "18px",
              color: "#FFFFFF",
              textShadow: "0 0 15px rgba(255,255,255,0.7), 0 0 25px rgba(255,255,255,0.5), 2px 2px 8px rgba(0,0,0,0.9)",
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
          <UnderConstruction language={language} accentColor={EVENTS_CATEGORY_THEME.accentColor} icon={CalendarDays} />
        )}

        {/* Events Grouped by Month with Accordion */}
        {!isLoading && events.length > 0 && (
          <MonthAccordion
            events={events}
            language={language}
            accentColor={EVENTS_CATEGORY_THEME.accentColor}
            badgeBg="#FFF7ED"
            badgeBorder="#FDBA74"
            countLabelSr="događaja"
            countLabelEn="events"
            renderCard={(event) => (
              <Link
                key={event.id}
                to={`/events/${event.id}`}
                className="cursor-pointer hover:scale-[1.02] transition-all duration-300 block"
                style={{ textDecoration: "none" }}
              >
                <img
                  src={event.image || "https://images.unsplash.com/photo-1540039155733-5bb30b53aa14?w=800"}
                  alt={event.title}
                  className="w-full h-[200px] object-cover rounded-lg"
                />
                <div className="p-4">
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <span className="text-sm font-medium" style={{ color: EVENTS_CATEGORY_THEME.accentColor }}>
                      {eventService.translateEventType(event.event_type || event.page_slug || '', language) || (language === "sr" ? "Događaj" : "Event")}
                    </span>
                    {/^(free|besplatn|gratis)/i.test(event.price || '') && (
                      <span className="text-xs font-medium px-2 py-1 rounded" style={{ background: "#F3F4F6", color: "#6B7280" }}>
                        {language === "sr" ? "Besplatan ulaz" : "Free Entry"}
                      </span>
                    )}
                  </div>
                  <h3 className="text-base font-semibold mb-2 line-clamp-2" style={{ color: "#1a1a1a" }}>
                    {language === "sr" ? event.title : (event.title_en || event.title)}
                  </h3>
                  {event.start_at && (
                    <>
                      <div className="flex items-center gap-2 mb-1">
                        <Calendar size={14} style={{ color: "#6B7280" }} />
                        <span className="text-sm" style={{ color: "#6B7280" }}>
                          {eventService.getRelativeDateLabel(event.start_at, language)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mb-1">
                        <Clock size={14} style={{ color: "#6B7280" }} />
                        <span className="text-sm" style={{ color: "#6B7280" }}>
                          {eventService.formatEventTime(event.start_at, event.end_at)}
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
                      <Heart size={12} style={{ color: EVENTS_CATEGORY_THEME.accentColor }} />
                      <span className="text-xs" style={{ color: "#9CA3AF" }}>
                        {interestCounts[event.id]} {language === "sr" ? "zainteresovano" : "interested"}
                      </span>
                    </div>
                  )}
                </div>
              </Link>
            )}
          />
        )}
      </div>
    </div>
  );
}