import { Link, useParams } from "react-router";
import { useState, useEffect } from "react";
import { useT } from "../hooks/useT";
import { ImageWithFallback } from "../components/figma/ImageWithFallback";
import { getVenueById } from "../utils/dataService";
import type { Item } from "../utils/dataService";
import { VenueBadgeRow, VenueHeroVenueTypeLabel } from "../components/VenueBadgeRow";
import {
  VenueDetailTwoColumnGrid,
  VenueDetailMainColumn,
  VenueDetailRightColumn,
  VenueDetailBottomCardRow,
  VenueDetailHoursCard,
  VenueDetailAddressCard,
  VenueDetailInfoCard,
} from "../components/VenueDetailLayout";
import { FOOD_VENUE_THEME } from "../utils/categoryThemes";

export function FoodAndDrinkDetailPage() {
  const { id } = useParams();
  const { t, language } = useT();
  const [restaurant, setRestaurant] = useState<Item | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch restaurant from database
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
        <div className="flex items-center justify-center h-[60vh]">
          <p className="text-2xl font-bold">{t('loading') || 'Loading'}...</p>
        </div>
      </div>
    );
  }

  if (!restaurant) {
    return (
      <div style={{ background: "#FAFBFC", minHeight: "100vh" }}>
        <div className="flex items-center justify-center h-[60vh] flex-col gap-4">
          <p className="text-2xl font-bold">{t('venueNotFound') || 'Restaurant not found'}</p>
          <Link to="/food-and-drink" className="text-blue-600 hover:underline">
            {t('backToRestaurants') || 'Back to Restaurants'}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: "#FAFBFC", minHeight: "100vh" }}>
      <div
        style={{
          position: "relative",
          height: "350px",
          background: FOOD_VENUE_THEME.heroGradient,
        }}
      >
        <ImageWithFallback
          src={restaurant.image}
          alt={language === 'en' && restaurant.title_en ? restaurant.title_en : restaurant.title}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            opacity: 0.3,
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
              "linear-gradient(to bottom, rgba(0,0,0,0.3), rgba(0,0,0,0.7))",
          }}
        />

        <div
          style={{
            position: "relative",
            maxWidth: "1280px",
            margin: "0 auto",
            paddingLeft: "20px",
            paddingRight: "20px",
            paddingTop: "40px",
            paddingBottom: "40px",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
          }}
        >
          <div>
            <VenueHeroVenueTypeLabel
              venue_type={restaurant.venue_type}
              t={t}
              accentColor={FOOD_VENUE_THEME.accentColor}
            />
            <h1
              style={{
                fontSize: "56px",
                fontWeight: 700,
                color: "white",
                marginBottom: "8px",
                letterSpacing: "-1px",
                lineHeight: "1.1",
              }}
            >
              {language === 'en' && restaurant.title_en ? restaurant.title_en : restaurant.title}
            </h1>
            <VenueBadgeRow
              cuisine={restaurant.cuisine}
              cuisine_en={restaurant.cuisine_en}
              tags={restaurant.tags}
              cuisineOnly
              language={language === 'en' ? 'en' : 'sr'}
              t={t}
              variant="onDark"
              className="flex flex-wrap items-center gap-2"
            />
          </div>
        </div>
      </div>

      <div
        style={{
          maxWidth: "1280px",
          margin: "0 auto",
          paddingLeft: "20px",
          paddingRight: "20px",
          paddingTop: "50px",
          paddingBottom: "50px",
        }}
      >
        <VenueDetailTwoColumnGrid
          mainColumn={
            <VenueDetailMainColumn
              bottomCards={
                <VenueDetailBottomCardRow>
                  <VenueDetailHoursCard
                    openingHoursText={restaurant.opening_hours}
                    openingHoursTextEn={restaurant.opening_hours_en}
                    language={language}
                    t={t}
                    accentColor={FOOD_VENUE_THEME.accentColor}
                  />
                  <VenueDetailAddressCard
                    address={restaurant.address}
                    mapUrl={restaurant.map_url}
                    t={t}
                    accentColor={FOOD_VENUE_THEME.accentColor}
                  />
                </VenueDetailBottomCardRow>
              }
            >
              <h2
                style={{
                  fontSize: "32px",
                  fontWeight: 700,
                  color: "#1A1D29",
                  marginBottom: "24px",
                  textShadow: "0 2px 4px rgba(0, 0, 0, 0.1)",
                }}
              >
                {t("aboutRestaurant")}
              </h2>
              <p
                style={{
                  fontSize: "16px",
                  lineHeight: "1.8",
                  color: "#4B5563",
                  marginBottom: "32px",
                  whiteSpace: "pre-wrap",
                  wordWrap: "break-word",
                  overflowWrap: "break-word",
                }}
              >
                {language === "en" && restaurant.description_en
                  ? restaurant.description_en
                  : restaurant.description}
              </p>
            </VenueDetailMainColumn>
          }
          rightColumn={
            <VenueDetailRightColumn>
              <VenueDetailInfoCard
                phone={restaurant.phone}
                contactPhone={restaurant.contact_phone}
                email={restaurant.contact_email}
                website={restaurant.website}
                t={t}
                accentColor={FOOD_VENUE_THEME.accentColor}
                callButtonLabel={t("callRestaurant") || "Call Restaurant"}
                ctaBackground={FOOD_VENUE_THEME.ctaBackground}
                ctaBorder={FOOD_VENUE_THEME.ctaBorder}
              />
            </VenueDetailRightColumn>
          }
        />
      </div>
    </div>
  );
}