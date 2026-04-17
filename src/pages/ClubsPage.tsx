import { useState, useEffect } from 'react';
import { Link } from 'react-router';
import { MapPin, Disc3 } from 'lucide-react';
import { useT } from '../hooks/useT';
import { useLanguage } from '../contexts/LanguageContext';
import { useLocation } from '../contexts/LocationContext';
import { useSEO } from "../hooks/useSEO";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import { DOC_TITLE_CLUBS, listingDocumentTitle } from "../utils/documentTitle";
import { getBreadcrumbSchema } from "../utils/structuredData";
import { getVenues } from "../utils/dataService";
import type { Item } from "../utils/dataService";
import ogImage from "../assets/5d3467711e1eb567830909e9073367edfa138777.png";
import clubsHeroImage from "../assets/7ad54244090ee97cf9170d61ce80eeb03b91c8aa.png";
import { UnderConstruction } from '../components/UnderConstruction';
import { VenueOpeningHoursRow } from '../components/VenueOpeningHoursRow';
import { CLUBS_CATEGORY_THEME, CLUBS_HERO_OVERLAY_GRADIENT } from "../utils/categoryThemes";
import { venueTagsFallbackLine } from "../utils/venueTagLabels";

export function ClubsPage() {
  const { t, language } = useT();
  const { selectedCity, getCityInLocative } = useLocation();
  const [clubs, setClubs] = useState<Item[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch clubs from database
  useEffect(() => {
    async function fetchClubs() {
      setIsLoading(true);
      const fetchedClubs = await getVenues('clubs');
      setClubs(fetchedClubs.slice(0, 12)); // Show first 12 as featured
      setIsLoading(false);
    }
    fetchClubs();
  }, []);

  useDocumentTitle(listingDocumentTitle(DOC_TITLE_CLUBS, selectedCity));

  // SEO optimization for clubs page
  useSEO({
    title: t("seoClubsTitle"),
    description: t("seoClubsDescription"),
    keywords: t("seoClubsKeywords"),
    ogImage: ogImage,
    ogType: "website",
    canonical: "https://blcityguide.com/clubs",
    structuredData: {
      "@context": "https://schema.org",
      "@graph": [
        getBreadcrumbSchema([
          { name: "Home", url: "https://blcityguide.com/" },
          {
            name: "Klubovi",
            url: "https://blcityguide.com/clubs",
          },
        ]),
        {
          "@type": "ItemList",
          name: "Klubovi u Banjoj Luci",
          description: "Lista najboljih klubova u Banjoj Luci",
          numberOfItems: 40,
        },
      ],
    },
  });

  return (
    <div
      className="min-h-screen"
      style={{ background: "#FFFFFF" }}
    >
      {/* HERO SECTION - Full Width */}
      <section
        className="relative w-full"
        style={{
          height: "420px",
          background: `${CLUBS_HERO_OVERLAY_GRADIENT}, url('${clubsHeroImage}') center/cover`,
        }}
      >
        <div className="relative z-10 h-full flex flex-col items-center justify-center px-4">
          <h1
            className="text-center mb-3"
            style={{
              fontSize: "42px",
              fontWeight: 700,
              color: "#FFFFFF",
              textShadow:
                "0 0 20px rgba(255,255,255,0.8), 0 0 30px rgba(255,255,255,0.6), 3px 3px 10px rgba(0,0,0,0.9)",
            }}
          >
            {t("nightRhythm")}
          </h1>
          <p
            className="text-center"
            style={{
              fontSize: "18px",
              color: "#FFFFFF",
              textShadow:
                "0 0 15px rgba(255,255,255,0.7), 0 0 25px rgba(255,255,255,0.5), 2px 2px 8px rgba(0,0,0,0.9)",
              maxWidth: "700px",
              margin: "0 auto",
            }}
          >
            {t("bestClubsParties")}
          </p>
        </div>
      </section>

      {/* CLUBS BY MUSIC GENRE - ROZA POZADINA */}
      <section
        className="py-16"
        style={{ background: "#FFFFFF" }}
      >
        <div className="w-[60vw] mx-auto">
          <h2
            className="mb-2.5 pb-2 lg:mb-4 lg:pb-3"
            style={{
              fontSize: "24px",
              fontWeight: 600,
              color: CLUBS_CATEGORY_THEME.accentColor,
              textShadow: "0 2px 4px rgba(0, 0, 0, 0.1)",
            }}
          >
            {t("clubsByMusicGenre")}
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-6" key={language}>
            {isLoading ? (
              <div className="col-span-3 text-center py-12">
                <p className="text-lg font-semibold text-gray-600">{t('loading')}</p>
              </div>
            ) : clubs.length === 0 ? (
              <div className="col-span-3">
                <UnderConstruction language={language} accentColor={CLUBS_CATEGORY_THEME.accentColor} icon={Disc3} />
              </div>
            ) : (
              clubs.slice(0, 9).map((club) => (
                <Link
                  key={club.id}
                  to={`/clubs/${club.id}`}
                  style={{ textDecoration: 'none' }}
                >
                  <div className="cursor-pointer hover:scale-[1.02] transition-all duration-300">
                    <img
                      src={club.image}
                      alt={language === 'en' && club.title_en ? club.title_en : club.title}
                      className="w-full h-[220px] object-cover rounded-md"
                    />
                    <div className="p-4">
                      {/* Category Badge */}
                      <div className="flex items-center gap-2 mb-2">
                        <span
                          className="text-xs font-medium px-2 py-1 rounded"
                          style={{
                            background: "#F3F4F6",
                            color: CLUBS_CATEGORY_THEME.accentColor,
                          }}
                        >
                          {venueTagsFallbackLine(
                            club.tags,
                            language === 'en' ? 'en' : 'sr',
                            t('nightlife')
                          )}
                        </span>
                      </div>

                      {/* Title */}
                      <h3
                        className="text-base font-semibold mb-2"
                        style={{ color: "#1a1a1a" }}
                      >
                        {language === 'en' && club.title_en ? club.title_en : club.title}
                      </h3>

                      {/* Location */}
                      <div className="flex items-center gap-2 mb-1">
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

                      {/* Hours */}
                      {club.opening_hours && (
                        <VenueOpeningHoursRow
                          hoursText={
                            language === 'en' && club.opening_hours_en
                              ? club.opening_hours_en
                              : club.opening_hours
                          }
                        />
                      )}
                    </div>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>
        {/* View All Clubs Button */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            marginTop: "40px",
          }}
        >
          <Link
            to="/clubs/all"
            style={{
              display: "inline-block",
              background: CLUBS_CATEGORY_THEME.ctaBackground,
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
            {t("viewAllClubs")}
          </Link>
        </div>
      </section>

      {/* FEATURED CLUBS */}
      <section
        className="py-16"
        style={{ background: "#FCE4EC" }}
      >
        <div className="w-[60vw] mx-auto">
          <h2
            className="mb-2.5 pb-2 lg:mb-4 lg:pb-3"
            style={{
              fontSize: "24px",
              fontWeight: 600,
              color: CLUBS_CATEGORY_THEME.accentColor,
              textShadow: "0 2px 4px rgba(0, 0, 0, 0.1)",
            }}
          >
            {t("featuredClubs")}
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
            {!isLoading && clubs.length > 0 ? (
              clubs.slice(0, 4).map((club) => (
                <Link
                  key={club.id}
                  to={`/clubs/${club.id}`}
                  style={{ textDecoration: 'none' }}
                >
                  <div className="cursor-pointer hover:scale-[1.02] transition-all duration-300">
                    <img
                      src={club.image}
                      alt={language === 'en' && club.title_en ? club.title_en : club.title}
                      className="w-full h-[300px] object-cover rounded-md"
                    />
                    <div className="p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <span
                          className="text-xs font-medium px-2 py-1 rounded"
                          style={{
                            background: "#F3F4F6",
                            color: CLUBS_CATEGORY_THEME.accentColor,
                          }}
                        >
                          {venueTagsFallbackLine(
                            club.tags,
                            language === 'en' ? 'en' : 'sr',
                            t('nightlife')
                          )}
                        </span>
                      </div>

                      <h3
                        className="text-base font-semibold mb-2"
                        style={{ color: "#1a1a1a" }}
                      >
                        {language === 'en' && club.title_en ? club.title_en : club.title}
                      </h3>

                      <div className="flex items-center gap-2 mb-1">
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

                      {club.opening_hours && (
                        <VenueOpeningHoursRow
                          hoursText={
                            language === 'en' && club.opening_hours_en
                              ? club.opening_hours_en
                              : club.opening_hours
                          }
                        />
                      )}
                    </div>
                  </div>
                </Link>
              ))
            ) : !isLoading ? (
              <div className="col-span-2">
                <UnderConstruction language={language} accentColor={CLUBS_CATEGORY_THEME.accentColor} icon={Disc3} />
              </div>
            ) : null}
          </div>
        </div>
      </section>

      {/* NEARBY CLUBS */}
      <section
        className="py-16"
        style={{ background: "#FFFFFF" }}
      >
        <div className="w-[60vw] mx-auto">
          <h2
            className="mb-2.5 pb-2 lg:mb-4 lg:pb-3"
            style={{
              fontSize: "24px",
              fontWeight: 600,
              color: CLUBS_CATEGORY_THEME.accentColor,
              textShadow: "0 2px 4px rgba(0, 0, 0, 0.1)",
            }}
          >
            {t("nearbyClubs")}
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mt-6">
            {/* ⚠️ FEATURED NEARBY CLUBS - OGRANIČENO NA 5 KARTICA ⚠️ */}
            {/* NOVI KLUB SE DODAJE SAMO NA /clubs/all STRANICU! */}
            {/* NE DODAVATI OVDJE - OVO JE FEATURED SEKCIJA SA FIKSNIH 5 KARTICA! */}
            {/* ⚠️ ZAŠTITA: .slice(0, 5) osigurava da se prikazuje MAKSIMALNO 5 kartica */}
            {[
              {
                image:
                  "https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjbHViJTIwbmlnaHQlMjBwYXJ0eXxlbnwxfHx8fDE3MzgxNTg0MDB8MA&ixlib=rb-4.1.0&q=80&w=1080",
                category: t("electronic"),
                priceRange: "€€",
                title: t("clubPrijedor"),
                location: t("prijedor"),
              },
              {
                image:
                  "https://images.unsplash.com/photo-1566737236500-c8ac43014a67?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxuaWdodGNsdWIlMjBkYW5jaW5nfGVufDF8fHx8MTczODE1ODQwMHww&ixlib=rb-4.1.0&q=80&w=1080",
                category: t("popDance"),
                priceRange: "€€€",
                title: t("clubGradiska"),
                location: t("gradiska"),
              },
              {
                image:
                  "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjb25jZXJ0JTIwbGl2ZSUyMG11c2ljfGVufDF8fHx8MTczODE1ODQwMHww&ixlib=rb-4.1.0&q=80&w=1080",
                category: t("liveMusic"),
                priceRange: "€€",
                title: t("barLiveDoboj"),
                location: t("doboj"),
              },
              {
                image:
                  "https://images.unsplash.com/photo-1516450137517-162bfbeb8dba?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxkaXNjbyUyMGJhbGx8ZW58MXx8fHwxNzM4MTU4NDAwfDA&ixlib=rb-4.1.0&q=80&w=1080",
                category: t("folkNarodna"),
                priceRange: "€",
                title: t("kafanaLaktasi"),
                location: t("laktasi"),
              },
              {
                image:
                  "https://images.unsplash.com/photo-1598387993281-cecf8b71a8f8?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxsb3VuZ2UlMjBiYXIlMjBjb2NrdGFpbHxlbnwxfHx8fDE3MzgxNTg0MDB8MA&ixlib=rb-4.1.0&q=80&w=1080",
                category: t("lounge"),
                priceRange: "€€€",
                title: t("loungeTeslic"),
                location: t("teslic"),
              },
            ].slice(0, 5).map((club, i) => (
              <div
                key={i}
                className="cursor-pointer hover:scale-[1.02] transition-all duration-300"
              >
                {/* Image */}
                <img
                  src={club.image}
                  alt={club.title}
                  className="w-full h-[250px] object-cover rounded-md"
                />

                {/* Content ISPOD SLIKE */}
                <div className="p-4">
                  {/* Category and Badge */}
                  <div className="flex items-center gap-2 mb-2">
                    <span
                      className="text-xs font-medium px-2 py-1 rounded"
                      style={{
                        background: "#F3F4F6",
                        color: CLUBS_CATEGORY_THEME.accentColor,
                      }}
                    >
                      {club.category}
                    </span>
                  </div>

                  {/* Title */}
                  <h3
                    className="text-base font-semibold mb-2"
                    style={{ color: "#1a1a1a" }}
                  >
                    {club.title}
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
                      {club.location}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}