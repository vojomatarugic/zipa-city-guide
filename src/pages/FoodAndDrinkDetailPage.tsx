import { Link, useParams } from "react-router";
import { useState, useEffect } from "react";
import { useT } from "../hooks/useT";
import { ImageWithFallback } from "../components/figma/ImageWithFallback";
import { getVenueById } from "../utils/dataService";
import type { Item } from "../utils/dataService";
import { VenueBadgeRow, VenueHeroVenueTypeLabel } from "../components/VenueBadgeRow";
import {
  VenueDetailUnifiedInfoCard,
  VenueDetailHoursCard,
  VenueDetailAddressCard,
} from "../components/VenueDetailLayout";
import { FOOD_VENUE_THEME } from "../utils/categoryThemes";

export function FoodAndDrinkDetailPage() {
  const { id } = useParams();
  const { t, language } = useT();
  const [restaurant, setRestaurant] = useState<Item | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchRestaurant() {
      if (!id) return;
      setIsLoading(true);
      const fetchedRestaurant = await getVenueById(id);
      setRestaurant(fetchedRestaurant);
      setIsLoading(false);
    }
    fetchRestaurant();
  }, [id]);

  if (isLoading) {
    return (
      <div style={{ background: "#FAFBFC", minHeight: "100vh" }}>
        <div className="max-w-7xl mx-auto px-4 py-16 text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-gray-200 border-t-blue-600"></div>
          <p className="mt-4 text-gray-600">
            {language === "sr" ? "Učitavanje..." : "Loading..."}
          </p>
        </div>
      </div>
    );
  }

  if (!restaurant) {
    return (
      <div style={{ background: "#FAFBFC", minHeight: "100vh" }}>
        <div className="max-w-7xl mx-auto px-4 py-16 text-center flex flex-col gap-4">
          <p className="text-gray-600 text-lg">
            {t("venueNotFound") || "Restaurant not found"}
          </p>
          <Link to="/food-and-drink" className="text-blue-600 hover:underline">
            {t("backToRestaurants") || "Back to Restaurants"}
          </Link>
        </div>
      </div>
    );
  }

  const title =
    language === "en" && restaurant.title_en
      ? restaurant.title_en
      : restaurant.title;
  const description =
    language === "en" && restaurant.description_en
      ? restaurant.description_en
      : restaurant.description;

  return (
    <div key={language} style={{ background: "#FAFBFC", minHeight: "100vh" }}>
      <div
        className="mx-auto w-full max-w-[1280px] px-5 pb-12 pt-8"
        style={{ boxSizing: "border-box" }}
      >
        <div
          className="w-full overflow-hidden bg-gray-100"
          style={{
            height: "400px",
            maxWidth: "1280px",
            margin: "0 auto",
            borderRadius: "16px",
          }}
        >
          <ImageWithFallback
            src={
              restaurant.image ||
              "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=1200"
            }
            alt={title}
            className="h-full w-full"
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              display: "block",
            }}
          />
        </div>

        <div className="grid grid-cols-1 items-stretch gap-6 pt-8 lg:grid-cols-3">
          <div className="col-span-1 flex h-full min-h-0 min-w-0 flex-col lg:col-span-2">
            <div className="flex h-full min-h-0 flex-col">
              <VenueHeroVenueTypeLabel
                venue_type={restaurant.venue_type}
                t={t}
                accentColor={FOOD_VENUE_THEME.accentColor}
                tone="onLight"
              />
              <h1
                className="m-0 tracking-tight"
                style={{
                  fontSize: "clamp(28px, 4vw, 44px)",
                  fontWeight: 700,
                  color: "#0f172a",
                  lineHeight: 1.15,
                  marginBottom: "16px",
                }}
              >
                {title}
              </h1>

              <VenueBadgeRow
                cuisine={restaurant.cuisine}
                cuisine_en={restaurant.cuisine_en}
                tags={restaurant.tags}
                cuisineOnly
                language={language === "en" ? "en" : "sr"}
                t={t}
                variant="default"
                className="flex flex-wrap items-center gap-2 mb-6"
              />

              <div
                className="max-w-[52rem]"
                style={{
                  fontSize: "17px",
                  lineHeight: 1.75,
                  color: "#1e293b",
                  marginBottom: "28px",
                  whiteSpace: "pre-wrap",
                  wordWrap: "break-word",
                  overflowWrap: "break-word",
                }}
              >
                {description}
              </div>

              <div className="mt-auto grid grid-cols-1 gap-6 md:grid-cols-2">
                <VenueDetailHoursCard
                  openingHoursText={restaurant.opening_hours}
                  openingHoursTextEn={restaurant.opening_hours_en}
                  language={language}
                  t={t}
                  accentColor={FOOD_VENUE_THEME.accentColor}
                />
                <VenueDetailAddressCard
                  address={restaurant.address}
                  city={restaurant.city}
                  mapUrl={restaurant.map_url}
                  t={t}
                  accentColor={FOOD_VENUE_THEME.accentColor}
                />
              </div>
            </div>
          </div>

          <div className="h-full min-h-0 min-w-0">
            <VenueDetailUnifiedInfoCard
              contactName={restaurant.contact_name}
              phone={restaurant.phone}
              contactPhone={restaurant.contact_phone}
              email={restaurant.contact_email}
              website={restaurant.website}
              address={restaurant.address}
              city={restaurant.city}
              mapUrl={restaurant.map_url}
              t={t}
              accentColor={FOOD_VENUE_THEME.accentColor}
              buttonBg={FOOD_VENUE_THEME.ctaBackground}
              buttonBorder={FOOD_VENUE_THEME.ctaBorder}
              callButtonLabel={t("callRestaurant") || "Call Restaurant"}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
