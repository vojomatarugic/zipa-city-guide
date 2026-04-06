import { useState, useEffect } from "react";
import { Link } from "react-router";
import { EventCard, EventCardSkeleton } from "../components/EventCard";
import { UnderConstruction } from "../components/UnderConstruction";
import { Music } from "lucide-react";
import { useT } from "../hooks/useT";
import { useLanguage } from "../contexts/LanguageContext";
import { useSEO } from "../hooks/useSEO";
import { getBreadcrumbSchema } from "../utils/structuredData";
import * as eventService from "../utils/eventService";
import { Item } from "../utils/dataService";
import ogImage from "../assets/5d3467711e1eb567830909e9073367edfa138777.png";
import concertsHeroImage from "../assets/b2e065a42a0a51bb75c2d1ea6e313313b9eeac02.png";
import { getTopLevelPageCategory } from "../utils/eventPageCategory";

export function ConcertsPage() {
  const { t } = useT();
  const { language } = useLanguage();
  const [events, setEvents] = useState<Item[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [interestCounts, setInterestCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    async function fetchConcerts() {
      setIsLoading(true);
      const fetched = await eventService.getEvents("upcoming", undefined);
      const concertOnly = fetched.filter(
        (e) => getTopLevelPageCategory(e) === "concerts"
      );
      setEvents(concertOnly);
      setIsLoading(false);

      const freeIds = concertOnly
        .filter(e => /^(free|besplatn|gratis)/i.test(e.price || '') || /^(free|besplatn|gratis)/i.test(e.price_en || ''))
        .map(e => e.id);
      if (freeIds.length > 0) {
        const counts = await eventService.batchGetInterestCounts(freeIds);
        setInterestCounts(counts);
      }
    }
    fetchConcerts();
  }, []);

  useSEO({
    title: t("seoConcertsTitle"),
    description: t("seoConcertsDescription"),
    keywords: t("seoConcertsKeywords"),
    ogImage: ogImage,
    ogType: "website",
    canonical: "https://blcityguide.com/concerts",
    structuredData: {
      "@context": "https://schema.org",
      "@graph": [
        getBreadcrumbSchema([
          { name: "Home", url: "https://blcityguide.com/" },
          { name: "Koncerti", url: "https://blcityguide.com/concerts" },
        ]),
      ],
    },
  });

  const upcomingConcerts = events.slice(0, 6);
  const featuredConcerts = events.slice(6, 9);
  const nearbyConcerts = events.filter(e => e.city && e.city !== 'Banja Luka').slice(0, 4);

  return (
    <div className="min-h-screen" style={{ background: "#FFFFFF" }}>
      {/* HERO SECTION */}
      <section className="relative w-full" style={{ height: "420px", marginTop: 0 }}>
        <img
          src={concertsHeroImage}
          alt="Koncerti u Banjaluci"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div
          className="absolute inset-0"
          style={{ background: "linear-gradient(rgba(192, 202, 51, 0.5), rgba(0, 0, 0, 0.7))" }}
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
            {t("concertsPageHero")}
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
              ? "Scena bez pauze — od glavnih bina do klupskih svirki."
              : "Non-stop scene — from main stages to club gigs."}
          </p>
        </div>
      </section>

      {/* Upcoming Concerts */}
      <section className="py-16" style={{ background: "#FFFFFF" }}>
        <div className="w-[60vw] mx-auto">
          <h2
            className="mb-4"
            style={{
              fontSize: "24px",
              fontWeight: 600,
              color: "#C0CA33",
              textShadow: "0 2px 4px rgba(0, 0, 0, 0.1)",
            }}
          >
            {language === "sr" ? "Predstojeći koncerti" : "Upcoming Concerts"}
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {isLoading ? (
              <EventCardSkeleton count={6} imageHeight="300px" />
            ) : upcomingConcerts.length > 0 ? (
              upcomingConcerts.map((event) => (
                <EventCard
                  key={event.id}
                  event={event}
                  language={language}
                  accentColor="#C0CA33"
                  imageHeight="300px"
                  interestCount={interestCounts[event.id]}
                />
              ))
            ) : (
              <div className="col-span-3">
                <UnderConstruction language={language} accentColor="#C0CA33" icon={Music} />
              </div>
            )}
          </div>

          {/* CTA Button */}
          <div className="mt-8 flex justify-center">
            <Link to="/concerts/all">
              <button
                className="px-8 py-3 rounded-md transition-all duration-300 hover:opacity-90 hover:shadow-lg"
                style={{ background: "#C0CA33", color: "#FFFFFF", fontSize: "16px", fontWeight: 500 }}
              >
                {language === "sr" ? "Pogledaj sve koncerte" : "View All Concerts"}
              </button>
            </Link>
          </div>
        </div>
      </section>

      {/* Featured Concerts */}
      <section className="py-16" style={{ background: "#F5F7E8" }}>
        <div className="w-[60vw] mx-auto">
          <h2
            className="text-left mb-6"
            style={{
              fontSize: "24px",
              fontWeight: 600,
              color: "#C0CA33",
              textShadow: "0 2px 4px rgba(0, 0, 0, 0.1)",
            }}
          >
            {language === "sr" ? "Istaknuti koncerti" : "Featured Concerts"}
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {featuredConcerts.length > 0 ? (
              featuredConcerts.map((event) => (
                <EventCard
                  key={event.id}
                  event={event}
                  language={language}
                  accentColor="#C0CA33"
                  imageHeight="400px"
                  interestCount={interestCounts[event.id]}
                />
              ))
            ) : (
              <div className="col-span-3">
                <UnderConstruction language={language} accentColor="#C0CA33" icon={Music} />
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Nearby Concerts */}
      <section className="pt-16 pb-8" style={{ background: "#FFFFFF" }}>
        <div className="w-[60vw] mx-auto">
          <h2
            className="mb-2.5 pb-2 lg:mb-4 lg:pb-3"
            style={{
              fontSize: "24px",
              fontWeight: 600,
              color: "#C0CA33",
              textShadow: "0 2px 4px rgba(0, 0, 0, 0.1)",
            }}
          >
            {language === "sr" ? "Koncerti u blizini" : "Nearby Concerts"}
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
            {nearbyConcerts.length > 0 ? (
              nearbyConcerts.map((event) => (
                <EventCard
                  key={event.id}
                  event={event}
                  language={language}
                  accentColor="#C0CA33"
                  imageHeight="300px"
                  interestCount={interestCounts[event.id]}
                />
              ))
            ) : (
              <div className="col-span-4">
                <UnderConstruction language={language} accentColor="#C0CA33" icon={Music} />
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}