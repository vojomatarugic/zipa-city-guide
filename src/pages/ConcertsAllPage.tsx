import { useState, useEffect, useMemo } from "react";
import { Calendar, MapPin, Clock, Music } from "lucide-react";
import { Link } from "react-router";
import { useT } from "../hooks/useT";
import { useLanguage } from "../contexts/LanguageContext";
import { useLocation } from "../contexts/LocationContext";
import { ImageWithFallback } from "../components/figma/ImageWithFallback";
import { UnderConstruction } from "../components/UnderConstruction";
import { MonthAccordion } from "../components/MonthAccordion";
import * as eventService from "../utils/eventService";
import { Item } from "../utils/dataService";
import concertsHeroImage from "../assets/concerts-hero.png";
import { getTopLevelPageCategory } from "../utils/eventPageCategory";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import {
  DOC_TITLE_CONCERTS,
  listingDocumentTitle,
} from "../utils/documentTitle";

export function ConcertsAllPage() {
  const { t } = useT();
  const { language } = useLanguage();
  const { selectedCity } = useLocation();

  const [events, setEvents] = useState<Item[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchConcerts() {
      setIsLoading(true);
      try {
        const fetched = await eventService.getEvents("all", selectedCity);
        const concertOnly = fetched.filter(
          (e) => getTopLevelPageCategory(e) === "concerts",
        );
        const now = new Date();
        const active = concertOnly
          .filter((e) => {
            if (!e.start_at) return false;
            const end = e.end_at ? new Date(e.end_at) : new Date(e.start_at);
            return end >= now;
          })
          .sort(
            (a, b) =>
              (a.start_at ? new Date(a.start_at).getTime() : 0) -
              (b.start_at ? new Date(b.start_at).getTime() : 0),
          );
        setEvents(active);
      } catch (err) {
        console.error("❌ ConcertsAllPage:", err);
      }
      setIsLoading(false);
    }
    fetchConcerts();
  }, [selectedCity]);

  const concertsAllTitle = useMemo(
    () => listingDocumentTitle(DOC_TITLE_CONCERTS, selectedCity),
    [selectedCity],
  );
  useDocumentTitle(concertsAllTitle);

  return (
    <div style={{ background: "#FFFFFF", minHeight: "100vh" }}>
      <div
        className="relative w-full"
        style={{
          height: "420px",
          background: "linear-gradient(135deg, #C0CA33, #D4E157)",
        }}
      >
        <img
          src={concertsHeroImage}
          alt="Koncerti u Banjaluci"
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            opacity: 1,
          }}
        />
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background:
              "linear-gradient(rgba(192, 202, 51, 0.5), rgba(0, 0, 0, 0.7))",
          }}
        />
        <div className="relative z-10 h-full flex flex-col justify-center items-center px-8 lg:px-24">
          <h1
            className="text-center"
            style={{
              fontSize: "42px",
              fontWeight: 700,
              color: "#FFFFFF",
              textShadow:
                "0 0 20px rgba(255,255,255,0.8), 0 0 30px rgba(255,255,255,0.6), 3px 3px 10px rgba(0,0,0,0.9)",
              letterSpacing: "-1px",
            }}
          >
            {language === "sr" ? (
              <>
                Svi koncerti i live nastupi
                <br />
                na jednom mjestu
              </>
            ) : (
              <>
                All concerts and live performances
                <br />
                in one place
              </>
            )}
          </h1>
        </div>
      </div>

      <div className="w-[60vw] mx-auto px-8 py-12">
        {isLoading && (
          <div className="text-center py-12">
            <p className="text-lg" style={{ color: "#6B7280" }}>
              {language === "sr" ? "Učitavanje..." : "Loading..."}
            </p>
          </div>
        )}

        {!isLoading && events.length === 0 && (
          <UnderConstruction
            language={language}
            accentColor="#C0CA33"
            icon={Music}
          />
        )}

        {!isLoading && events.length > 0 && (
          <MonthAccordion
            key={selectedCity}
            events={events}
            language={language}
            accentColor="#C0CA33"
            badgeBg="#F9FBE7"
            badgeBorder="#C0CA33"
            countPluralForms={{
              sr: { one: "koncert", few: "koncerta", many: "koncerata" },
              en: { one: "concert", many: "concerts" },
            }}
            renderCard={(event) => (
              <Link
                key={event.id}
                to={`/events/${event.id}`}
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
                      className="text-xs font-medium px-2 py-1 rounded"
                      style={{ background: "#F3F4F6", color: "#C0CA33" }}
                    >
                      {event.event_type
                        ? eventService.translateEventType(
                            event.event_type,
                            language,
                          )
                        : language === "sr"
                          ? "Koncert"
                          : "Concert"}
                    </span>
                    {event.price && (
                      <span
                        className="text-xs font-medium px-2 py-1 rounded"
                        style={{ background: "#F3F4F6", color: "#6B7280" }}
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
                </div>
              </Link>
            )}
          />
        )}
      </div>
    </div>
  );
}
