import { useState, useEffect } from "react";
import { Link } from "react-router";
import { Calendar, MapPin, Star } from "lucide-react";
import { EventCardSkeleton } from "../components/EventCard";
import { UnderConstruction } from "../components/UnderConstruction";
import { Clapperboard } from "lucide-react";
import { useT } from "../hooks/useT";
import { useLanguage } from "../contexts/LanguageContext";
import { useSEO } from "../hooks/useSEO";
import { getBreadcrumbSchema } from "../utils/structuredData";
import * as eventService from "../utils/eventService";
import { Item } from "../utils/dataService";
import { getTopLevelPageCategory } from "../utils/eventPageCategory";
import ogImage from "../assets/5d3467711e1eb567830909e9073367edfa138777.png";
import cinemaHeroImage from "../assets/8fd8ca41ddd7aefadbb24990bbf75bf03885286c.png";

/**
 * Cinema-specific card with star rating display
 */
function CinemaCard({ event, language, imageHeight = "300px" }: { event: Item; language: string; imageHeight?: string }) {
  const lang = language === "en" ? "en" : "sr";
  const title = lang === "sr" ? event.title : (event.title_en || event.title);
  const isFree = /^(free|besplatn|gratis)/i.test(event.price || '');
  const eventType = eventService.translateEventType(event.event_type || '', lang);
  const dateLabel = event.start_at ? eventService.getRelativeDateLabel(event.start_at, lang) : '';
  const timeLabel = event.start_at ? eventService.formatEventTime(event.start_at, event.end_at) : '';
  const venue = event.venue_name || event.address || event.city || '';

  return (
    <Link
      to={`/events/${event.id}`}
      className="cursor-pointer hover:scale-[1.02] transition-all duration-300 block"
      style={{ textDecoration: "none" }}
    >
      <img
        src={event.image || "https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=600"}
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
        <h3 className="text-base font-semibold mb-2" style={{ color: "#1a1a1a" }}>
          {title}
        </h3>
        {dateLabel && (
          <div className="flex items-center gap-2 mb-1">
            <Calendar size={14} style={{ color: "#6B7280" }} />
            <span className="text-sm" style={{ color: "#6B7280" }}>
              {dateLabel}{timeLabel ? ` • ${timeLabel}` : ''}
            </span>
          </div>
        )}
        {venue && (
          <div className="flex items-center gap-2">
            <MapPin size={14} style={{ color: "#6B7280" }} />
            <span className="text-sm" style={{ color: "#6B7280" }}>{venue}</span>
          </div>
        )}
      </div>
    </Link>
  );
}

export function CinemaPage() {
  const { t } = useT();
  const { language } = useLanguage();
  const [events, setEvents] = useState<Item[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchCinema() {
      setIsLoading(true);
      const fetched = await eventService.getEvents("upcoming", undefined);
      setEvents(
        fetched.filter((e) => getTopLevelPageCategory(e) === "cinema")
      );
      setIsLoading(false);
    }
    fetchCinema();
  }, []);

  useSEO({
    title: t("seoCinemaTitle"),
    description: t("seoCinemaDescription"),
    keywords: t("seoCinemaKeywords"),
    ogImage: ogImage,
    ogType: "website",
    canonical: "https://blcityguide.com/cinema",
    structuredData: {
      "@context": "https://schema.org",
      "@graph": [
        getBreadcrumbSchema([
          { name: "Home", url: "https://blcityguide.com/" },
          { name: "Bioskop", url: "https://blcityguide.com/cinema" },
        ]),
      ],
    },
  });

  const nowShowing = events.slice(0, 5);
  const comingSoon = events.slice(5, 13);
  const nearby = events.filter(e => e.city && e.city !== 'Banja Luka').slice(0, 4);

  return (
    <div className="min-h-screen" style={{ background: "#FFFFFF" }}>
      {/* HERO SECTION */}
      <section className="relative w-full" style={{ height: "420px", marginTop: 0 }}>
        <img
          src={cinemaHeroImage}
          alt={t("cinema")}
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div
          className="absolute inset-0"
          style={{ background: "linear-gradient(rgba(0, 137, 123, 0.5), rgba(0, 0, 0, 0.7))" }}
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
            {t("cinemaPageHero")}
          </h1>
          <p
            className="text-[20px] max-w-[600px] text-center"
            style={{
              fontSize: "18px",
              color: "#FFFFFF",
              textShadow: "0 0 15px rgba(255,255,255,0.7), 0 0 25px rgba(255,255,255,0.5), 2px 2px 8px rgba(0,0,0,0.9)",
            }}
          >
            {language === "sr"
              ? "Novi filmovi, premijere i omiljeni naslovi na velikom platnu."
              : "New movies, premieres and favorite titles on the big screen."}
          </p>
        </div>
      </section>

      {/* NOW SHOWING */}
      <section className="py-16 overflow-hidden" style={{ background: "#FFFFFF" }}>
        <div className="w-[60vw] mx-auto">
          <h2
            className="text-left"
            style={{ fontSize: "24px", fontWeight: 600, color: "#00897B", marginBottom: "24px" }}
          >
            {language === "sr" ? "Repertoar" : "Now Showing"}
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {isLoading ? (
              <EventCardSkeleton count={5} imageHeight="300px" />
            ) : nowShowing.length > 0 ? (
              nowShowing.map((event) => (
                <CinemaCard key={event.id} event={event} language={language} imageHeight="300px" />
              ))
            ) : (
              <div className="col-span-5">
                <UnderConstruction language={language} accentColor="#00897B" icon={Clapperboard} />
              </div>
            )}
          </div>

          <div style={{ display: "flex", justifyContent: "center", marginTop: "40px" }}>
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

      {/* COMING SOON */}
      <section className="py-16" style={{ background: "#E0F2F1" }}>
        <div className="w-[60vw] mx-auto">
          <h2
            style={{ fontSize: "24px", fontWeight: 600, color: "#00897B", marginBottom: "24px" }}
          >
            {language === "sr" ? "Uskoro u bioskopu" : "Coming Soon"}
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {comingSoon.length > 0 ? (
              comingSoon.map((event) => (
                <CinemaCard key={event.id} event={event} language={language} imageHeight="400px" />
              ))
            ) : (
              <div className="col-span-4">
                <UnderConstruction language={language} accentColor="#00897B" icon={Clapperboard} />
              </div>
            )}
          </div>
        </div>
      </section>

      {/* NEARBY CINEMAS */}
      <section className="py-16" style={{ background: "#FFFFFF" }}>
        <div className="w-[60vw] mx-auto">
          <h2
            className="text-left"
            style={{ fontSize: "24px", fontWeight: 600, color: "#00897B", marginBottom: "24px" }}
          >
            {language === "sr" ? "Bioskopi u okolini" : "Nearby Cinemas"}
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {nearby.length > 0 ? (
              nearby.map((event) => (
                <CinemaCard key={event.id} event={event} language={language} imageHeight="280px" />
              ))
            ) : (
              <div className="col-span-4">
                <UnderConstruction language={language} accentColor="#00897B" icon={Clapperboard} />
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}