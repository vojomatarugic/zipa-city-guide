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
import { CLUBS_CATEGORY_THEME } from "../utils/categoryThemes";

export function ClubDetailPage() {
  const { id } = useParams();
  const { t, language } = useT();
  const [club, setClub] = useState<Item | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch club from database
  useEffect(() => {
    async function fetchClub() {
      if (!id) return;
      setIsLoading(true);
      const fetchedClub = await getVenueById(id);
      setClub(fetchedClub);
      setIsLoading(false);
    }
    fetchClub();
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

  if (!club) {
    return (
      <div style={{ background: "#FAFBFC", minHeight: "100vh" }}>
        <div className="flex items-center justify-center h-[60vh] flex-col gap-4">
          <p className="text-2xl font-bold">{t('clubNotFound') || 'Club not found'}</p>
          <Link to="/clubs" className="text-blue-600 hover:underline">
            {t('backToClubs') || 'Back to Clubs'}
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
          background: CLUBS_CATEGORY_THEME.heroGradient,
        }}
      >
        <ImageWithFallback
          src={club.image}
          alt={language === 'en' && club.title_en ? club.title_en : club.title}
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
              venue_type={club.venue_type || "nightclub"}
              t={t}
              accentColor={CLUBS_CATEGORY_THEME.accentColor}
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
              {language === 'en' && club.title_en ? club.title_en : club.title}
            </h1>
            <VenueBadgeRow
              cuisine={club.cuisine}
              cuisine_en={club.cuisine_en}
              tags={club.tags}
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
                    openingHoursText={club.opening_hours}
                    openingHoursTextEn={club.opening_hours_en}
                    language={language}
                    t={t}
                    accentColor={CLUBS_CATEGORY_THEME.accentColor}
                  />
                  <VenueDetailAddressCard
                    address={club.address}
                    mapUrl={club.map_url}
                    t={t}
                    accentColor={CLUBS_CATEGORY_THEME.accentColor}
                  />
                </VenueDetailBottomCardRow>
              }
            >
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
                {language === "en" && club.description_en ? club.description_en : club.description}
              </p>
            </VenueDetailMainColumn>
          }
          rightColumn={
            <VenueDetailRightColumn>
              <VenueDetailInfoCard
                phone={club.phone}
                contactPhone={club.contact_phone}
                email={club.contact_email}
                website={club.website}
                t={t}
                accentColor={CLUBS_CATEGORY_THEME.accentColor}
                callButtonLabel={t("callClub") || "Call Club"}
                ctaBackground={CLUBS_CATEGORY_THEME.ctaBackground}
                ctaBorder={CLUBS_CATEGORY_THEME.ctaBorder}
              />
            </VenueDetailRightColumn>
          }
        />
      </div>
    </div>
  );
}