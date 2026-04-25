import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router";
import { MapPin, MapPinned, Utensils } from "lucide-react";
import { SectionEmptyState } from "../components/SectionEmptyState";
import { useT } from "../hooks/useT";
import { useLocation } from "../contexts/LocationContext";
import { useSEO } from "../hooks/useSEO";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import { DOC_TITLE_FOOD, listingDocumentTitle } from "../utils/documentTitle";
import { getBreadcrumbSchema } from "../utils/structuredData";
import { SITE_URL } from "../config/siteConfig";
import { getVenues, getFeaturedVenues } from "../utils/dataService";
import type { Item } from "../utils/dataService";
import { VenueBadgeRow } from "../components/VenueBadgeRow";
import { VenueOpeningHoursRow } from "../components/VenueOpeningHoursRow";
import { cityEquals } from "../utils/city";
import { venueDetailPath } from "../utils/venueRouting";
const ogImage = "/zipa-city-guide-OG.png";
import foodAndDrinkHeroImage from "../assets/food-and-drink-hero.png";
import { RevealOnScrollArticle } from "../components/RevealOnScrollArticle";

// Reusable card component for venue items
function VenueCard({
  item,
  language,
  t,
}: {
  item: Item;
  language: string;
  t: (key: string) => string;
}) {
  return (
    <Link to={venueDetailPath(item)} style={{ textDecoration: "none" }}>
      <div className="cursor-pointer hover:scale-[1.02] transition-all duration-300">
        <img
          src={item.image}
          alt={language === "en" && item.title_en ? item.title_en : item.title}
          className="w-full h-[200px] object-cover rounded-md"
        />
        <div className="p-4">
          <VenueBadgeRow
            venue_type={item.venue_type}
            cuisine={item.cuisine}
            cuisine_en={item.cuisine_en}
            tags={item.tags}
            language={language === "en" ? "en" : "sr"}
            t={t}
            pageSlug="food-and-drink"
          />
          <h3
            className="text-base font-semibold mb-2"
            style={{ color: "#1a1a1a" }}
          >
            {language === "en" && item.title_en ? item.title_en : item.title}
          </h3>
          <div className="flex items-center gap-2 mb-1">
            {String(item.address || "").trim() ? (
              <MapPin size={14} style={{ color: "#6B7280" }} />
            ) : (
              <MapPinned size={14} style={{ color: "#6B7280" }} />
            )}
            <span className="text-sm" style={{ color: "#6B7280" }}>
              {item.address || item.city || "Banja Luka"}
            </span>
          </div>
          {item.opening_hours && (
            <VenueOpeningHoursRow
              hoursText={
                language === "en" && item.opening_hours_en
                  ? item.opening_hours_en
                  : item.opening_hours
              }
            />
          )}
        </div>
      </div>
    </Link>
  );
}

// Reusable category section
function CategorySection({
  titleSr,
  titleEn,
  items,
  isLoading,
  language,
  t,
  bgColor = "#FFFFFF",
  columns = 4,
}: {
  titleSr: string;
  titleEn: string;
  items: Item[];
  isLoading: boolean;
  language: string;
  t: (key: string) => string;
  bgColor?: string;
  columns?: number;
}) {
  const gridClass =
    columns === 3
      ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
      : "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4";

  return (
    <section className="py-16 min-h-[320px]" style={{ background: bgColor }}>
      <div className="w-[60vw] mx-auto">
        <h2
          style={{
            fontSize: "24px",
            fontWeight: 600,
            color: "#8B6F47",
            textShadow: "0 2px 4px rgba(0, 0, 0, 0.1)",
            marginBottom: "24px",
          }}
        >
          {language === "sr" ? titleSr : titleEn}
        </h2>

        {isLoading ? (
          <div className="text-center py-12">
            <p className="text-lg font-semibold text-gray-600">
              {t("loading")}
            </p>
          </div>
        ) : items.length === 0 ? (
          <SectionEmptyState
            icon={Utensils}
            accentColor="#8B6F47"
            message={
              language === "sr"
                ? "Trenutno nema sadržaja u ovoj sekciji."
                : "There is currently no content in this section."
            }
          />
        ) : (
          <div className={gridClass}>
            {items.map((item) => (
              <RevealOnScrollArticle key={item.id}>
                <VenueCard item={item} language={language} t={t} />
              </RevealOnScrollArticle>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

export function FoodAndDrinkPage() {
  const { t, language } = useT();
  const { selectedCity } = useLocation();
  const [foodAndDrinkVenues, setFoodAndDrinkVenues] = useState<Item[]>([]);
  const [featuredFoodAndDrink, setFeaturedFoodAndDrink] = useState<Item[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchFoodAndDrinkVenues() {
      setIsLoading(true);
      const [fetchedVenues, fetchedFeatured] = await Promise.all([
        getVenues("food-and-drink"),
        getFeaturedVenues(),
      ]);
      setFoodAndDrinkVenues(fetchedVenues);

      const featuredFiltered = fetchedFeatured
        .filter((v) => v.page_slug === "food-and-drink")
        .slice(0, 4);
      setFeaturedFoodAndDrink(
        featuredFiltered.length > 0
          ? featuredFiltered
          : fetchedVenues.slice(0, 4),
      );

      setIsLoading(false);
    }
    fetchFoodAndDrinkVenues();
  }, []);

  const SECTION_LIMIT = 4;
  const filterByType = (type: string) =>
    foodAndDrinkVenues
      .filter((r) => r.venue_type === type)
      .slice(0, SECTION_LIMIT);

  const cevabdzinice = filterByType("cevabdzinica");
  const restaurantVenues = filterByType("restaurant");
  const cafes = filterByType("cafe");
  const fastFood = filterByType("fast_food");
  const pizzerias = filterByType("pizzeria");
  const dessertShops = filterByType("dessert_shop");
  const pubs = filterByType("pub");

  const KNOWN_TYPES = [
    "cevabdzinica",
    "restaurant",
    "cafe",
    "fast_food",
    "pizzeria",
    "dessert_shop",
    "pub",
    "nightclub",
    "other",
  ];
  const otherVenues = foodAndDrinkVenues
    .filter((r) => {
      const vt = (r.venue_type || "").trim();
      return vt === "" || !KNOWN_TYPES.includes(vt);
    })
    .slice(0, SECTION_LIMIT);

  const nearbyFoodAndDrink = selectedCity
    ? foodAndDrinkVenues
        .filter((r) => cityEquals(r.city, selectedCity))
        .slice(0, 3)
    : foodAndDrinkVenues.slice(Math.max(0, foodAndDrinkVenues.length - 3));

  const foodTitle = useMemo(
    () => listingDocumentTitle(DOC_TITLE_FOOD, selectedCity),
    [selectedCity],
  );
  useDocumentTitle(foodTitle);

  useSEO({
    title: t("seoFoodAndDrinkTitle"),
    description: t("seoFoodAndDrinkDescription"),
    keywords: t("seoFoodAndDrinkKeywords"),
    ogImage: ogImage,
    ogType: "website",
    canonical: SITE_URL + "/food-and-drink",
    structuredData: {
      "@context": "https://schema.org",
      "@graph": [
        getBreadcrumbSchema([
          { name: "Home", url: SITE_URL + "/" },
          {
            name: language === "en" ? "Food & Drink" : "Hrana i piće",
            url: SITE_URL + "/food-and-drink",
          },
        ]),
        {
          "@type": "ItemList",
          name:
            language === "en"
              ? "Food & Drink in Banja Luka"
              : "Hrana i piće u Banjoj Luci",
          description:
            language === "en"
              ? "Best restaurants, cafes and bars in Banja Luka"
              : "Najbolja mjesta za hranu i piće u Banjoj Luci",
          numberOfItems: 50,
        },
      ],
    },
  });

  return (
    <div className="min-h-screen" style={{ background: "#FFFFFF" }}>
      {/* HERO */}
      <section
        className="relative w-full min-h-[320px]"
        style={{ height: "420px", marginTop: 0 }}
      >
        <img
          src={foodAndDrinkHeroImage}
          alt={
            language === "en"
              ? "Food and drink in Banja Luka"
              : "Hrana i piće u Banjoj Luci"
          }
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(rgba(139, 111, 71, 0.5), rgba(0, 0, 0, 0.7))",
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
            {t("foodAndDrink")}
          </h1>
          <p
            className="max-w-[600px] text-center"
            style={{
              fontSize: "18px",
              color: "#FFFFFF",
              textShadow:
                "0 0 15px rgba(255,255,255,0.7), 0 0 25px rgba(255,255,255,0.5), 2px 2px 8px rgba(0,0,0,0.9)",
            }}
          >
            {t("foodAndDrinkPageDesc")}
          </p>
        </div>
      </section>

      {/* 1. ĆEVABDŽINICE */}
      <CategorySection
        titleSr="Ćevabdžinice"
        titleEn="Cevapi Restaurant"
        items={cevabdzinice}
        isLoading={isLoading}
        language={language}
        t={t}
        bgColor="#FFFFFF"
      />

      {/* 2. ISTAKNUTO */}
      {!isLoading && featuredFoodAndDrink.length > 0 && (
        <section className="py-16 min-h-[320px]" style={{ background: "#FAF7F2" }}>
          <div className="w-[60vw] mx-auto">
            <h2
              style={{
                fontSize: "24px",
                fontWeight: 600,
                color: "#8B6F47",
                textShadow: "0 2px 4px rgba(0, 0, 0, 0.1)",
                marginBottom: "24px",
              }}
            >
              {language === "sr" ? "Istaknuto" : "Featured"}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {featuredFoodAndDrink.slice(0, 4).map((venue) => (
                <RevealOnScrollArticle key={venue.id}>
                  <Link
                    to={venueDetailPath(venue)}
                    style={{ textDecoration: "none" }}
                  >
                    <div className="cursor-pointer hover:scale-[1.02] transition-all duration-300">
                      <img
                        src={venue.image}
                        alt={
                          language === "en" && venue.title_en
                            ? venue.title_en
                            : venue.title
                        }
                        className="w-full h-[400px] object-cover rounded-md"
                      />
                      <div className="p-4">
                        <VenueBadgeRow
                          venue_type={venue.venue_type}
                          cuisine={venue.cuisine}
                          cuisine_en={venue.cuisine_en}
                          tags={venue.tags}
                          language={language === "en" ? "en" : "sr"}
                          t={t}
                          pageSlug="food-and-drink"
                        />
                        <h3
                          className="text-base font-semibold mt-2 mb-1"
                          style={{ color: "#1a1a1a" }}
                        >
                          {language === "en" && venue.title_en
                            ? venue.title_en
                            : venue.title}
                        </h3>
                        <div className="flex items-center gap-2">
                          {String(venue.address || "").trim() ? (
                            <MapPin size={14} style={{ color: "#6B7280" }} />
                          ) : (
                            <MapPinned size={14} style={{ color: "#6B7280" }} />
                          )}
                          <span className="text-sm" style={{ color: "#6B7280" }}>
                            {venue.address || venue.city || "Banja Luka"}
                          </span>
                        </div>
                        {venue.opening_hours && (
                          <VenueOpeningHoursRow
                            className="mt-1"
                            hoursText={
                              language === "en" && venue.opening_hours_en
                                ? venue.opening_hours_en
                                : venue.opening_hours
                            }
                          />
                        )}
                      </div>
                    </div>
                  </Link>
                </RevealOnScrollArticle>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* 3. RESTORANI */}
      <CategorySection
        titleSr="Restorani"
        titleEn="Restaurants"
        items={restaurantVenues}
        isLoading={isLoading}
        language={language}
        t={t}
        bgColor="#FFFFFF"
      />

      {/* 4. KAFIĆI */}
      <CategorySection
        titleSr="Kafići"
        titleEn="Cafés"
        items={cafes}
        isLoading={isLoading}
        language={language}
        t={t}
        bgColor="#FAF7F2"
      />

      {/* 5. FAST FOOD */}
      <CategorySection
        titleSr="Fast food"
        titleEn="Fast Food"
        items={fastFood}
        isLoading={isLoading}
        language={language}
        t={t}
        bgColor="#FFFFFF"
      />

      {/* 6. PICERIJE */}
      <CategorySection
        titleSr="Picerije"
        titleEn="Pizzerias"
        items={pizzerias}
        isLoading={isLoading}
        language={language}
        t={t}
        bgColor="#FAF7F2"
      />

      {/* 7. POSLASTIČARNICE */}
      <CategorySection
        titleSr="Poslastičarnice"
        titleEn="Dessert Shops"
        items={dessertShops}
        isLoading={isLoading}
        language={language}
        t={t}
        bgColor="#FFFFFF"
      />

      {/* 8. PIVNICE & PUBOVI */}
      <CategorySection
        titleSr="Pivnice & Pubovi"
        titleEn="Brewpubs & Pubs"
        items={pubs}
        isLoading={isLoading}
        language={language}
        t={t}
        bgColor="#FAF7F2"
      />

      {/* 9. OSTALE LOKACIJE */}
      <CategorySection
        titleSr="Ostale lokacije"
        titleEn="Other Venues"
        items={otherVenues}
        isLoading={isLoading}
        language={language}
        t={t}
        bgColor="#FFFFFF"
      />

      {/* 10. HRANA I PIĆE U BLIZINI */}
      {!isLoading && nearbyFoodAndDrink.length > 0 && (
        <section className="py-16 min-h-[320px]" style={{ background: "#FAF7F2" }}>
          <div className="w-[60vw] mx-auto">
            <h2
              style={{
                fontSize: "24px",
                fontWeight: 600,
                color: "#8B6F47",
                textShadow: "0 2px 4px rgba(0, 0, 0, 0.1)",
                marginBottom: "24px",
              }}
            >
              {language === "sr"
                ? "Hrana i piće u blizini"
                : "Food & Drink Nearby"}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {nearbyFoodAndDrink.map((venue) => (
                <RevealOnScrollArticle key={venue.id}>
                  <Link
                    to={venueDetailPath(venue)}
                    style={{ textDecoration: "none" }}
                  >
                    <div className="cursor-pointer hover:scale-[1.02] transition-all duration-300">
                      <img
                        src={venue.image}
                        alt={
                          language === "en" && venue.title_en
                            ? venue.title_en
                            : venue.title
                        }
                        className="w-full h-[250px] object-cover rounded-md"
                      />
                      <div className="p-4">
                        <VenueBadgeRow
                          venue_type={venue.venue_type}
                          cuisine={venue.cuisine}
                          cuisine_en={venue.cuisine_en}
                          tags={venue.tags}
                          language={language === "en" ? "en" : "sr"}
                          t={t}
                          pageSlug="food-and-drink"
                        />
                        <h3
                          className="text-base font-semibold mt-2 mb-1"
                          style={{ color: "#1a1a1a" }}
                        >
                          {language === "en" && venue.title_en
                            ? venue.title_en
                            : venue.title}
                        </h3>
                        <div className="flex items-center gap-2">
                          {String(venue.address || "").trim() ? (
                            <MapPin size={14} style={{ color: "#6B7280" }} />
                          ) : (
                            <MapPinned size={14} style={{ color: "#6B7280" }} />
                          )}
                          <span className="text-sm" style={{ color: "#6B7280" }}>
                            {venue.address || venue.city || "Banja Luka"}
                          </span>
                        </div>
                        {venue.opening_hours && (
                          <VenueOpeningHoursRow
                            className="mt-1"
                            hoursText={
                              language === "en" && venue.opening_hours_en
                                ? venue.opening_hours_en
                                : venue.opening_hours
                            }
                          />
                        )}
                      </div>
                    </div>
                  </Link>
                </RevealOnScrollArticle>
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
