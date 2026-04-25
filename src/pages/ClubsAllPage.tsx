import { useState, useEffect, useMemo } from "react";
import { CalendarDays, Disc3, MapPin, MapPinned } from "lucide-react";
import { Link } from "react-router";
import { useT } from "../hooks/useT";
import { useLanguage } from "../contexts/LanguageContext";
import { useLocation as useSelectedCity } from "../contexts/LocationContext";
import { ImageWithFallback } from "../components/figma/ImageWithFallback";
import { SectionEmptyState } from "../components/SectionEmptyState";
import { RevealOnScrollArticle } from "../components/RevealOnScrollArticle";
import { getVenues } from "../utils/dataService";
import type { Item } from "../utils/dataService";
import clubsHeroImage from "../assets/clubs-hero.png";
import { VenueOpeningHoursRow } from "../components/VenueOpeningHoursRow";
import {
  CLUBS_CATEGORY_THEME,
  CLUBS_LISTING_HERO_OVERLAY,
  getBadgeTextColorForPageSlug,
  LISTING_BADGE_SURFACE_CLASS,
} from "../utils/categoryThemes";
import { venueTagsFallbackLine } from "../utils/venueTagLabels";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import { DOC_TITLE_CLUBS, listingDocumentTitle } from "../utils/documentTitle";
import { venueDetailPath } from "../utils/venueRouting";

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

export function ClubsAllPage() {
  const { t } = useT();
  const { language } = useLanguage();
  const { selectedCity } = useSelectedCity();
  const [clubs, setClubs] = useState<Item[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [visibleByMonth, setVisibleByMonth] = useState<Record<string, number>>(
    {},
  );
  const INITIAL_VISIBLE_PER_MONTH = 6;
  const LOAD_MORE_STEP = 6;

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

  const groupedByMonth = useMemo(() => {
    const grouped: Record<string, Item[]> = {};
    const monthOrder: string[] = [];

    const sortedClubs = [...clubs].sort(
      (a, b) =>
        new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime(),
    );

    sortedClubs.forEach((club) => {
      const dateSource = club.created_at || club.date;
      if (!dateSource) return;

      const date = new Date(dateSource);
      if (Number.isNaN(date.getTime())) return;

      const key = `${date.getFullYear()}-${String(date.getMonth()).padStart(2, "0")}`;
      if (!grouped[key]) {
        grouped[key] = [];
        monthOrder.push(key);
      }
      grouped[key].push(club);
    });

    return { grouped, monthOrder };
  }, [clubs]);

  return (
    <div style={{ background: "#FFFFFF", minHeight: "100vh" }}>
      {/* Same hero shell as ConcertsAllPage: fixed height, base gradient, cover image, overlay, centered title */}
      <div
        className="relative w-full"
        style={{
          height: "420px",
          background: CLUBS_CATEGORY_THEME.heroGradient,
        }}
      >
        <img
          src={clubsHeroImage}
          alt={
            language === "sr" ? "Klubovi u Banjaluci" : "Clubs in Banja Luka"
          }
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
          <SectionEmptyState
            icon={Disc3}
            accentColor={CLUBS_CATEGORY_THEME.accentColor}
            message={language === "sr" ? "Trenutno nema sadržaja u ovoj sekciji." : "There is currently no content in this section."}
          />
        )}

        {!isLoading && clubs.length > 0 && (
          <>
            <div className="mb-6">
              <p className="text-sm" style={{ color: "#6B7280" }}>
                {language === "sr"
                  ? `Pronađeno ${clubs.length} klubova`
                  : `Found ${clubs.length} clubs`}
              </p>
            </div>

            {groupedByMonth.monthOrder.map((monthKey) => {
              const monthClubs = groupedByMonth.grouped[monthKey];
              const visibleCount =
                visibleByMonth[monthKey] ?? INITIAL_VISIBLE_PER_MONTH;
              const visibleClubs = monthClubs.slice(0, visibleCount);
              const hiddenCount = Math.max(monthClubs.length - visibleCount, 0);
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
                        background: `linear-gradient(135deg, ${CLUBS_CATEGORY_THEME.accentColor} 0%, ${CLUBS_CATEGORY_THEME.accentColor}CC 100%)`,
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
                        background: "#FCE4EC",
                        color: CLUBS_CATEGORY_THEME.accentColor,
                        border: `1px solid ${CLUBS_CATEGORY_THEME.accentColor}`,
                      }}
                    >
                      {monthClubs.length} {language === "sr" ? "klubova" : "clubs"}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {visibleClubs.map((club) => (
                      <RevealOnScrollArticle key={club.id}>
                        <Link
                          to={venueDetailPath(club)}
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
                                className={LISTING_BADGE_SURFACE_CLASS}
                                style={{
                                  color: getBadgeTextColorForPageSlug("clubs"),
                                }}
                              >
                                {venueTagsFallbackLine(
                                  club.tags,
                                  language === "en" ? "en" : "sr",
                                  t("clubs"),
                                )}
                              </span>
                              {club.opening_hours && (
                                <span
                                  className={`${LISTING_BADGE_SURFACE_CLASS} inline-block max-w-full align-top`}
                                  style={{
                                    color: getBadgeTextColorForPageSlug("clubs"),
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
                              {String(club.address || "").trim() ? (
                                <MapPin size={14} style={{ color: "#6B7280" }} />
                              ) : (
                                <MapPinned size={14} style={{ color: "#6B7280" }} />
                              )}
                              <span className="text-sm" style={{ color: "#6B7280" }}>
                                {club.address || club.city || "Banja Luka"}
                              </span>
                            </div>
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
                          color: CLUBS_CATEGORY_THEME.accentColor,
                          border: `2px solid ${CLUBS_CATEGORY_THEME.accentColor}`,
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
