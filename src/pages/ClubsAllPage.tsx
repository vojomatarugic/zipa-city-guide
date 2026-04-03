import {
  Music,
  MapPin,
  Users,
  ArrowLeft,
} from "lucide-react";
import { Link } from "react-router";
import { useState, useEffect } from "react";
import { useT } from "../hooks/useT";
import { useLanguage } from "../contexts/LanguageContext";
import { ImageWithFallback } from "../components/figma/ImageWithFallback";
import { Header } from "../components/Header";
import { Footer } from "../components/Footer";
import { getVenues } from "../utils/dataService";
import type { Item } from "../utils/dataService";
import clubsHeroImage from "../assets/7ad54244090ee97cf9170d61ce80eeb03b91c8aa.png";
import { VenueOpeningHoursRow } from "../components/VenueOpeningHoursRow";

export function ClubsAllPage() {
  const { t, language } = useT();
  const [clubs, setClubs] = useState<Item[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch clubs from database
  useEffect(() => {
    async function fetchClubs() {
      setIsLoading(true);
      const fetchedClubs = await getVenues('clubs');
      setClubs(fetchedClubs);
      setIsLoading(false);
    }
    fetchClubs();
  }, []);

  return (
    <div style={{ background: "#FFFFFF", minHeight: "100vh" }}>
      <Header />

      {/* Hero Section */}
      <section
        className="relative w-full"
        style={{
          height: "250px",
          marginTop: 0,
        }}
      >
        {/* Background Image */}
        <img
          src={clubsHeroImage}
          alt="Klubovi u Banjaluci"
          className="absolute inset-0 w-full h-full object-cover"
        />

        {/* Purple Overlay */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(rgba(123, 31, 162, 0.5), rgba(0, 0, 0, 0.7))",
          }}
        />

        {/* Content */}
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
            {t("allClubsTitleBanjaLuka")}
          </h1>
        </div>
      </section>

      {/* Clubs Grid */}
      <div className="py-16" style={{ background: "#FAFBFC" }}>
        <div className="w-[60vw] mx-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {isLoading ? (
              <div className="col-span-3 text-center">
                <p className="text-xl font-bold">{t('loading') || 'Loading'}...</p>
              </div>
            ) : clubs.length === 0 ? (
              <div className="col-span-3 text-center">
                <p className="text-lg text-gray-500">{language === 'sr' ? 'U pripremi — uskoro će biti dostupno!' : 'Under construction — coming soon!'}</p>
              </div>
            ) : (
              clubs.map((club) => (
                <Link
                  key={club.id}
                  to={`/clubs/${club.id}`}
                  style={{ textDecoration: "none" }}
                >
                  <div className="cursor-pointer hover:scale-[1.02] transition-all duration-300">
                    {/* Image */}
                    <ImageWithFallback
                      src={club.image}
                      alt={language === 'en' && club.title_en ? club.title_en : club.title}
                      className="w-full h-[200px] object-cover rounded-md"
                    />

                    {/* Content ISPOD SLIKE */}
                    <div className="p-4">
                      {/* Category Badge */}
                      <div className="flex items-center gap-2 mb-2">
                        <span
                          className="text-xs font-medium px-2 py-1 rounded"
                          style={{
                            background: "#F3F4F6",
                            color: "#7B1FA2",
                          }}
                        >
                          {t('nightlife')}
                        </span>
                        {club.opening_hours && (
                          <span
                            className="text-xs font-medium px-2 py-1 rounded inline-block max-w-full align-top"
                            style={{
                              background: "#F3F4F6",
                              color: "#6B7280",
                            }}
                          >
                            <VenueOpeningHoursRow
                              className="inline-flex max-w-full"
                              gapClassName="gap-1"
                              clockSize={12}
                              clockClassName="shrink-0 mt-0.5"
                              textClassName="text-xs font-medium"
                              hoursText={
                                language === 'en' && club.opening_hours_en
                                  ? club.opening_hours_en
                                  : club.opening_hours
                              }
                            />
                          </span>
                        )}
                      </div>

                      {/* Title */}
                      <h3
                        className="text-base font-semibold mb-2"
                        style={{ color: "#1a1a1a" }}
                      >
                        {language === 'en' && club.title_en ? club.title_en : club.title}
                      </h3>

                      {/* Location */}
                      <div className="flex items-center gap-2">
                        <MapPin
                          size={14}
                          style={{ color: "#6B7280" }}
                        />
                        <span
                          className="text-sm"
                          style={{ color: "#6B7280" }}
                        >
                          {club.address || club.city || 'Banja Luka'}
                        </span>
                      </div>
                    </div>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <Footer />
    </div>
  );
}