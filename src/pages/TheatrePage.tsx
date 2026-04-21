import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router";
import { EventCard, EventCardSkeleton } from "../components/EventCard";
import { UnderConstruction } from "../components/UnderConstruction";
import { Drama } from "lucide-react";
import { useT } from "../hooks/useT";
import { useLanguage } from "../contexts/LanguageContext";
import { useSEO } from "../hooks/useSEO";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import { useLocation as useSelectedCity } from "../contexts/LocationContext";
import {
  DOC_TITLE_THEATRE,
  listingDocumentTitle,
} from "../utils/documentTitle";
import { getBreadcrumbSchema } from "../utils/structuredData";
import { SITE_URL } from "../config/siteConfig";
import * as eventService from "../utils/eventService";
import { Item } from "../utils/dataService";
import { getTopLevelPageCategory } from "../utils/eventPageCategory";
import ogImage from "../assets/5d3467711e1eb567830909e9073367edfa138777.png";
import theatreHeroImage from "../assets/c7c3d29642e3d9901c6110dae2bf02f98da5daeb.png";

function isApprovedTheatreEvent(e: Item): boolean {
  if (e.status !== "approved") return false;
  if (
    String(e.page_slug || "")
      .toLowerCase()
      .trim() === "theatre"
  )
    return true;
  return getTopLevelPageCategory(e) === "theatre";
}

function sortByStartAtAsc(events: Item[]): Item[] {
  return [...events].sort(
    (a, b) =>
      (a.start_at ? new Date(a.start_at).getTime() : 0) -
      (b.start_at ? new Date(b.start_at).getTime() : 0),
  );
}

function isActiveThroughNow(e: Item, now: Date): boolean {
  if (!e.start_at) return false;
  const end = e.end_at ? new Date(e.end_at) : new Date(e.start_at);
  return end >= now;
}

function mergeSortTheatreOtherCities(events: Item[], now: Date): Item[] {
  return sortByStartAtAsc(events.filter((e) => isActiveThroughNow(e, now)));
}

export function TheatrePage() {
  const { t } = useT();
  const { language } = useLanguage();
  const { selectedCity } = useSelectedCity();
  const [events, setEvents] = useState<Item[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [interestCounts, setInterestCounts] = useState<Record<string, number>>(
    {},
  );

  useEffect(() => {
    async function fetchTheatre() {
      setIsLoading(true);
      const [bySlug, byType] = await Promise.all([
        eventService.getEvents("all", undefined, undefined, "theatre"),
        eventService.getEvents("all", undefined, "theatre"),
      ]);
      const byId = new Map<string, Item>();
      for (const e of [...bySlug, ...byType]) {
        if (isApprovedTheatreEvent(e)) byId.set(e.id, e);
      }
      setEvents([...byId.values()]);
      setIsLoading(false);
    }
    fetchTheatre();
  }, []);

  const { repertoire, moreFromRepertoire, nearby } = useMemo(() => {
    const now = new Date();
    const inCity = events.filter((e) => e.city === selectedCity);
    const activeInCity = sortByStartAtAsc(
      inCity.filter((e) => isActiveThroughNow(e, now)),
    );
    const repertoire = activeInCity.slice(0, 4);
    const moreFromRepertoire = activeInCity.slice(4, 10);

    const nearby = mergeSortTheatreOtherCities(
      events.filter((e) => e.city && e.city !== selectedCity),
      now,
    ).slice(0, 4);

    return { repertoire, moreFromRepertoire, nearby };
  }, [events, selectedCity]);

  useEffect(() => {
    const freeIds = [...repertoire, ...moreFromRepertoire, ...nearby]
      .filter((e) => /^(free|besplatn|gratis)/i.test(e.price || ""))
      .map((e) => e.id);
    if (freeIds.length === 0) {
      setInterestCounts({});
      return;
    }
    eventService.batchGetInterestCounts(freeIds).then(setInterestCounts);
  }, [repertoire, moreFromRepertoire, nearby]);

  useDocumentTitle(listingDocumentTitle(DOC_TITLE_THEATRE, selectedCity));

  useSEO({
    title: t("seoTheatreTitle"),
    description: t("seoTheatreDescription"),
    keywords: t("seoTheatreKeywords"),
    ogImage: ogImage,
    ogType: "website",
    canonical: SITE_URL + "/theatre",
    structuredData: {
      "@context": "https://schema.org",
      "@graph": [
        getBreadcrumbSchema([
          { name: "Home", url: SITE_URL + "/" },
          { name: "Pozorište", url: SITE_URL + "/theatre" },
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
          src={theatreHeroImage}
          alt={t("theatre")}
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
            }}
          >
            {t("theatrePageHero")}
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
              ? "Aktuelne predstave i scenski programi u gradu."
              : "Current plays and stage programs in the city."}
          </p>
        </div>
      </section>

      {/* REPERTOIRE */}
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
              color: "#8E24AA",
              marginBottom: "24px",
              textShadow: "0 2px 4px rgba(0, 0, 0, 0.1)",
            }}
          >
            {language === "sr" ? "Scenski repertoar" : "Stage Repertoire"}
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {isLoading ? (
              <EventCardSkeleton count={4} imageHeight="380px" />
            ) : repertoire.length > 0 ? (
              repertoire.map((event) => (
                <EventCard
                  key={event.id}
                  event={event}
                  language={language}
                  accentColor="#8E24AA"
                  imageHeight="380px"
                  interestCount={interestCounts[event.id]}
                />
              ))
            ) : (
              <div className="col-span-4">
                <UnderConstruction
                  language={language}
                  accentColor="#8E24AA"
                  icon={Drama}
                />
              </div>
            )}
          </div>

          {/* CTA Button */}
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              marginTop: "40px",
            }}
          >
            <Link
              to="/theatre/all"
              style={{
                display: "inline-block",
                background: "#8E24AA",
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
              {language === "sr"
                ? "Pogledaj sav repertoar"
                : "View Full Repertoire"}
            </Link>
          </div>
        </div>
      </section>

      {/* UPCOMING EVENTS */}
      <section className="py-16" style={{ background: "#F3E5F5" }}>
        <div className="w-[60vw] mx-auto">
          <h2
            style={{
              fontSize: "24px",
              fontWeight: 600,
              color: "#8E24AA",
              marginBottom: "24px",
              textShadow: "0 2px 4px rgba(0, 0, 0, 0.1)",
            }}
          >
            {language === "sr" ? "U najavi" : "Coming Soon"}
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {isLoading ? (
              <EventCardSkeleton count={3} imageHeight="400px" />
            ) : moreFromRepertoire.length > 0 ? (
              moreFromRepertoire.map((event) => (
                <EventCard
                  key={event.id}
                  event={event}
                  language={language}
                  accentColor="#8E24AA"
                  imageHeight="400px"
                  interestCount={interestCounts[event.id]}
                />
              ))
            ) : (
              <div className="col-span-3">
                <UnderConstruction
                  language={language}
                  accentColor="#8E24AA"
                  icon={Drama}
                />
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Nearby Theatre */}
      <section className="pt-16 pb-8" style={{ background: "#FFFFFF" }}>
        <div className="w-[60vw] mx-auto">
          <h2
            style={{
              fontSize: "24px",
              fontWeight: 600,
              color: "#8E24AA",
              marginBottom: "24px",
              textShadow: "0 2px 4px rgba(0, 0, 0, 0.1)",
            }}
          >
            {language === "sr" ? "Predstave u blizini" : "Nearby Performances"}
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {nearby.length > 0 ? (
              nearby.map((event) => (
                <EventCard
                  key={event.id}
                  event={event}
                  language={language}
                  accentColor="#8E24AA"
                  imageHeight="320px"
                  interestCount={interestCounts[event.id]}
                />
              ))
            ) : (
              <div className="col-span-4">
                <UnderConstruction
                  language={language}
                  accentColor="#8E24AA"
                  icon={Drama}
                />
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
