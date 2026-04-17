import { useState, useEffect, useMemo } from "react";
import { Disc3, MapPin } from "lucide-react";
import { Link } from "react-router";
import { useT } from "../hooks/useT";
import { useLanguage } from "../contexts/LanguageContext";
import { useLocation as useSelectedCity } from "../contexts/LocationContext";
import { ImageWithFallback } from "../components/figma/ImageWithFallback";
import { UnderConstruction } from "../components/UnderConstruction";
import { getVenues } from "../utils/dataService";
import type { Item } from "../utils/dataService";
import clubsHeroImage from "../assets/7ad54244090ee97cf9170d61ce80eeb03b91c8aa.png";
import { VenueOpeningHoursRow } from "../components/VenueOpeningHoursRow";
import {
  CLUBS_CATEGORY_THEME,
  CLUBS_LISTING_HERO_OVERLAY,
} from "../utils/categoryThemes";
import { venueTagsFallbackLine } from "../utils/venueTagLabels";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import { DOC_TITLE_CLUBS, listingDocumentTitle } from "../utils/documentTitle";

export function ClubsAllPage() {
  const { t } = useT();
  const { language } = useLanguage();
  const { selectedCity } = useSelectedCity();
  const [clubs, setClubs] = useState<Item[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchClubs() {
      setIsLoading(true);
      try {
        const fetchedClubs = await getVenues("clubs");
        setClubs(fetchedClubs);
      } catch (err) {
        console.error("❌ ClubsAllPage:", err);
      }
      setIsLoading(false);
    }
    fetchClubs();
  }, []);

  const clubsAllTitle = useMemo(
    () => listingDocumentTitle(DOC_TITLE_CLUBS, selectedCity),
    [selectedCity],
  );
  useDocumentTitle(clubsAllTitle);

  return (
    <div style={{ background: "#FFFFFF", minHeight: "100vh" }}>
      {/* Same hero shell as ConcertsAllPage: fixed height, base gradient, cover image, overlay, centered title */}
      <div
        className="relative w-full"
        style={{
          height: "350px",
          background: CLUBS_CATEGORY_THEME.heroGradient,
        }}
      >
        <img
          src={clubsHeroImage}
          alt={language === "sr" ? "Klubovi u Banjaluci" : "Clubs in Banja Luka"}
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
            background: CLUBS_LISTING_HERO_OVERLAY,
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
            {t("allClubsTitleBanjaLuka")}
            <br />
            {t("clubsAllHeroSubline")}
          </h1>
        </div>
      </div>

      {/* Same main column as ConcertsAllPage: 60vw + horizontal padding + vertical rhythm */}
      <div className="w-[60vw] mx-auto px-8 py-12">
        {isLoading && (
          <div className="text-center py-12">
            <p className="text-lg" style={{ color: "#6B7280" }}>
              {language === "sr" ? "Učitavanje..." : "Loading..."}
            </p>
          </div>
        )}

        {!isLoading && clubs.length === 0 && (
          <UnderConstruction
            language={language}
            accentColor={CLUBS_CATEGORY_THEME.accentColor}
            icon={Disc3}
          />
        )}

        {!isLoading && clubs.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {clubs.map((club) => (
              <Link
                key={club.id}
                to={`/clubs/${club.id}`}
                className="cursor-pointer hover:scale-[1.02] transition-all duration-300 block"
                style={{ textDecoration: "none" }}
              >
                <ImageWithFallback
                  src={club.image}
                  alt={
                    language === "en" && club.title_en
                      ? club.title_en
                      : club.title
                  }
                  className="w-full h-[200px] object-cover rounded-md"
                />
                <div className="p-4">
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <span
                      className="text-xs font-medium px-2 py-1 rounded"
                      style={{
                        background: "#F3F4F6",
                        color: CLUBS_CATEGORY_THEME.accentColor,
                      }}
                    >
                      {venueTagsFallbackLine(
                        club.tags,
                        language === "en" ? "en" : "sr",
                        t("nightlife")
                      )}
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
                            language === "en" && club.opening_hours_en
                              ? club.opening_hours_en
                              : club.opening_hours
                          }
                        />
                      </span>
                    )}
                  </div>

                  <h3
                    className="text-base font-semibold mb-2"
                    style={{ color: "#1a1a1a" }}
                  >
                    {language === "en" && club.title_en
                      ? club.title_en
                      : club.title}
                  </h3>

                  <div className="flex items-center gap-2">
                    <MapPin size={14} style={{ color: "#6B7280" }} />
                    <span className="text-sm" style={{ color: "#6B7280" }}>
                      {club.address || club.city || "Banja Luka"}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
