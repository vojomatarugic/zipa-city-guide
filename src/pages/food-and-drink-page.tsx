import { useState, useEffect } from "react";
import { Link } from "react-router";
import { Header } from "../components/Header";
import { Footer } from "../components/Footer";
import { MapPin, Utensils } from "lucide-react";
import { UnderConstruction } from "../components/UnderConstruction";
import { useT } from "../hooks/useT";
import { useLocation } from "../contexts/LocationContext";
import { useSEO } from "../hooks/useSEO";
import { getBreadcrumbSchema } from "../utils/structuredData";
import { getVenues, getFeaturedVenues } from "../utils/dataService";
import type { Item } from "../utils/dataService";
import { VenueBadgeRow } from "../components/VenueBadgeRow";
import { VenueOpeningHoursRow } from "../components/VenueOpeningHoursRow";
import ogImage from "../assets/ae3d44fbb2bace1359cf1d0dcf503ab46d8abef2.png";
import restaurantsHeroImage from "../assets/124a9756dea5764367ff53e5154e06c6b335de75.png";

// Reusable card component for venue items
function VenueCard({ item, language, t }: { item: Item; language: string; t: (key: string) => string }) {
  return (
    <Link
      to={`/food-and-drink/${item.id}`}
      style={{ textDecoration: 'none' }}
    >
      <div className="cursor-pointer hover:scale-[1.02] transition-all duration-300">
        <img
          src={item.image}
          alt={language === 'en' && item.title_en ? item.title_en : item.title}
          className="w-full h-[200px] object-cover rounded-md"
        />
        <div className="p-4">
          <VenueBadgeRow venue_type={item.venue_type} cuisine={item.cuisine} t={t} />
          <h3 className="text-base font-semibold mb-2" style={{ color: "#1a1a1a" }}>
            {language === 'en' && item.title_en ? item.title_en : item.title}
          </h3>
          <div className="flex items-center gap-2 mb-1">
            <MapPin size={14} style={{ color: "#6B7280" }} />
            <span className="text-sm" style={{ color: "#6B7280" }}>
              {item.address || item.city || 'Banja Luka'}
            </span>
          </div>
          {item.opening_hours && (
            <VenueOpeningHoursRow
              hoursText={language === 'en' && item.opening_hours_en ? item.opening_hours_en : item.opening_hours}
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
    <section className="py-16" style={{ background: bgColor }}>
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
            <p className="text-lg font-semibold text-gray-600">{t('loading')}</p>
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-12">
            <UnderConstruction language={language} accentColor="#E5E9F0" icon={Utensils} />
          </div>
        ) : (
          <div className={gridClass}>
            {items.map((item) => (
              <VenueCard key={item.id} item={item} language={language} t={t} />
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
  const [allRestaurants, setAllRestaurants] = useState<Item[]>([]);
  const [featuredRestaurants, setFeaturedRestaurants] = useState<Item[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchRestaurants() {
      setIsLoading(true);
      const [fetchedRestaurants, fetchedFeatured] = await Promise.all([
        getVenues('food-and-drink'),
        getFeaturedVenues(),
      ]);
      setAllRestaurants(fetchedRestaurants);

      const featuredFiltered = fetchedFeatured
        .filter(v => v.page_slug === 'food-and-drink')
        .slice(0, 4);
      setFeaturedRestaurants(
        featuredFiltered.length > 0 ? featuredFiltered : fetchedRestaurants.slice(0, 4)
      );

      setIsLoading(false);
    }
    fetchRestaurants();
  }, []);

  const SECTION_LIMIT = 4;
  const filterByType = (type: string) =>
    allRestaurants.filter(r => r.venue_type === type).slice(0, SECTION_LIMIT);

  const cevabdzinice = filterByType('cevabdzinica');
  const restaurants = filterByType('restaurant');
  const cafes = filterByType('cafe');
  const fastFood = filterByType('fast_food');
  const pizzerias = filterByType('pizzeria');
  const dessertShops = filterByType('dessert_shop');
  const pubs = filterByType('pub');

  const KNOWN_TYPES = [
    'cevabdzinica', 'restaurant', 'cafe', 'fast_food',
    'pizzeria', 'dessert_shop', 'pub', 'nightclub', 'other',
  ];
  const otherVenues = allRestaurants
    .filter(r => {
      const vt = (r.venue_type || '').trim();
      return vt === '' || !KNOWN_TYPES.includes(vt);
    })
    .slice(0, SECTION_LIMIT);

  const nearbyRestaurants = selectedCity
    ? allRestaurants.filter(r => (r.city || '').toLowerCase().includes(selectedCity.toLowerCase())).slice(0, 3)
    : allRestaurants.slice(Math.max(0, allRestaurants.length - 3));

  useSEO({
    title: t("seoRestaurantsTitle"),
    description: t("seoRestaurantsDescription"),
    keywords: t("seoRestaurantsKeywords"),
    ogImage: ogImage,
    ogType: "website",
    canonical: "https://blcityguide.com/food-and-drink",
    structuredData: {
      "@context": "https://schema.org",
      "@graph": [
        getBreadcrumbSchema([
          { name: "Home", url: "https://blcityguide.com/" },
          {
            name: language === 'en' ? "Food & Drink" : "Hrana i piće",
            url: "https://blcityguide.com/food-and-drink",
          },
        ]),
        {
          "@type": "ItemList",
          name: language === 'en' ? "Food & Drink in Banja Luka" : "Hrana i piće u Banjoj Luci",
          description: language === 'en'
            ? "Best restaurants, cafes and bars in Banja Luka"
            : "Najbolja mjesta za hranu i piće u Banjoj Luci",
          numberOfItems: 50,
        },
      ],
    },
  });

  return (
    <div className="min-h-screen" style={{ background: "#FFFFFF" }}>
      <Header />

      {/* HERO */}
      <section className="relative w-full" style={{ height: "420px", marginTop: 0 }}>
        <img
          src={restaurantsHeroImage}
          alt="Restorani u Banjaluci"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div
          className="absolute inset-0"
          style={{ background: "linear-gradient(rgba(139, 111, 71, 0.5), rgba(0, 0, 0, 0.7))" }}
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
            {t("foodAndDrink")}
          </h1>
          <p
            className="max-w-[600px] text-center"
            style={{
              fontSize: "18px",
              color: "#FFFFFF",
              textShadow: "0 0 15px rgba(255,255,255,0.7), 0 0 25px rgba(255,255,255,0.5), 2px 2px 8px rgba(0,0,0,0.9)",
            }}
          >
            {t("restaurantsPageDesc")}
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
      {!isLoading && featuredRestaurants.length > 0 && (
        <section className="py-16" style={{ background: "#FAF7F2" }}>
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
              {featuredRestaurants.slice(0, 4).map((restaurant) => (
                <Link
                  key={restaurant.id}
                  to={`/food-and-drink/${restaurant.id}`}
                  style={{ textDecoration: 'none' }}
                >
                  <div className="cursor-pointer hover:scale-[1.02] transition-all duration-300">
                    <img
                      src={restaurant.image}
                      alt={language === 'en' && restaurant.title_en ? restaurant.title_en : restaurant.title}
                      className="w-full h-[400px] object-cover rounded-md"
                    />
                    <div className="p-4">
                      <VenueBadgeRow venue_type={restaurant.venue_type} cuisine={restaurant.cuisine} t={t} />
                      <h3 className="text-base font-semibold mt-2 mb-1" style={{ color: "#1a1a1a" }}>
                        {language === 'en' && restaurant.title_en ? restaurant.title_en : restaurant.title}
                      </h3>
                      <div className="flex items-center gap-2">
                        <MapPin size={14} style={{ color: "#6B7280" }} />
                        <span className="text-sm" style={{ color: "#6B7280" }}>
                          {restaurant.address || restaurant.city || 'Banja Luka'}
                        </span>
                      </div>
                      {restaurant.opening_hours && (
                        <VenueOpeningHoursRow
                          className="mt-1"
                          hoursText={
                            language === 'en' && restaurant.opening_hours_en
                              ? restaurant.opening_hours_en
                              : restaurant.opening_hours
                          }
                        />
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* 3. RESTORANI */}
      <CategorySection
        titleSr="Restorani"
        titleEn="Restaurants"
        items={restaurants}
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
      {!isLoading && nearbyRestaurants.length > 0 && (
        <section className="py-16" style={{ background: '#FAF7F2' }}>
          <div className="w-[60vw] mx-auto">
            <h2
              style={{
                fontSize: '24px',
                fontWeight: 600,
                color: '#8B6F47',
                textShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
                marginBottom: '24px',
              }}
            >
              {language === 'sr' ? 'Hrana i piće u blizini' : 'Food & Drink Nearby'}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {nearbyRestaurants.map((restaurant) => (
                <Link
                  key={restaurant.id}
                  to={`/food-and-drink/${restaurant.id}`}
                  style={{ textDecoration: 'none' }}
                >
                  <div className="cursor-pointer hover:scale-[1.02] transition-all duration-300">
                    <img
                      src={restaurant.image}
                      alt={language === 'en' && restaurant.title_en ? restaurant.title_en : restaurant.title}
                      className="w-full h-[250px] object-cover rounded-md"
                    />
                    <div className="p-4">
                      <VenueBadgeRow venue_type={restaurant.venue_type} cuisine={restaurant.cuisine} t={t} />
                      <h3 className="text-base font-semibold mt-2 mb-1" style={{ color: "#1a1a1a" }}>
                        {language === 'en' && restaurant.title_en ? restaurant.title_en : restaurant.title}
                      </h3>
                      <div className="flex items-center gap-2">
                        <MapPin size={14} style={{ color: "#6B7280" }} />
                        <span className="text-sm" style={{ color: "#6B7280" }}>
                          {restaurant.address || restaurant.city || 'Banja Luka'}
                        </span>
                      </div>
                      {restaurant.opening_hours && (
                        <VenueOpeningHoursRow
                          className="mt-1"
                          hoursText={
                            language === 'en' && restaurant.opening_hours_en
                              ? restaurant.opening_hours_en
                              : restaurant.opening_hours
                          }
                        />
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      <Footer />
    </div>
  );
}