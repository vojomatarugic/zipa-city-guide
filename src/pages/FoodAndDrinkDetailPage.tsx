import { Link, useParams } from "react-router";
import { useState, useEffect, useMemo } from "react";
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
import { useLocation as useSelectedCity } from "../contexts/LocationContext";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import {
  detailDocumentTitle,
  detailLoadingDocumentTitle,
} from "../utils/documentTitle";

export function FoodAndDrinkDetailPage() {
  const { id } = useParams();
  const { t, language } = useT();
  const { selectedCity } = useSelectedCity();
  const [venue, setVenue] = useState<Item | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const documentTitle = useMemo(() => {
    if (isLoading || !venue) return detailLoadingDocumentTitle();
    const entityTitle =
      language === "en" && venue.title_en ? venue.title_en : venue.title;
    return detailDocumentTitle(entityTitle, selectedCity);
  }, [isLoading, venue, language, selectedCity]);

  useDocumentTitle(documentTitle);

  useEffect(() => {
    async function fetchVenue() {
      if (!id) return;
      setIsLoading(true);
      const fetched = await getVenueById(id);
      setVenue(fetched);
      setIsLoading(false);
    }
    fetchVenue();
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

  if (!venue) {
    return (
      <div style={{ background: "#FAFBFC", minHeight: "100vh" }}>
        <div className="max-w-7xl mx-auto px-4 py-16 text-center flex flex-col gap-4">
          <p className="text-gray-600 text-lg">
            {t("venueNotFound") || "Restaurant not found"}
          </p>
          <Link to="/food-and-drink" className="text-blue-600 hover:underline">
            {t("backToFoodAndDrink") || "Back to Food & Drink"}
          </Link>
        </div>
      </div>
    );
  }

  const title =
    language === "en" && venue.title_en ? venue.title_en : venue.title;
  const description =
    language === "en" && venue.description_en
      ? venue.description_en
      : venue.description;

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
              venue.image ||
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
                venue_type={venue.venue_type}
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
                cuisine={venue.cuisine}
                cuisine_en={venue.cuisine_en}
                tags={venue.tags}
                cuisineOnly
                language={language === "en" ? "en" : "sr"}
                t={t}
                pageSlug="food-and-drink"
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
                  openingHoursText={venue.opening_hours}
                  openingHoursTextEn={venue.opening_hours_en}
                  language={language}
                  t={t}
                  accentColor={FOOD_VENUE_THEME.accentColor}
                />
                <VenueDetailAddressCard
                  address={venue.address}
                  city={venue.city}
                  mapUrl={venue.map_url}
                  t={t}
                  accentColor={FOOD_VENUE_THEME.accentColor}
                />
              </div>
            </div>
          </div>

          <div className="h-full min-h-0 min-w-0">
            <VenueDetailUnifiedInfoCard
              contactName={venue.contact_name}
              phone={venue.phone}
              contactPhone={venue.contact_phone}
              email={venue.contact_email}
              website={venue.website}
              address={venue.address}
              city={venue.city}
              mapUrl={venue.map_url}
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
