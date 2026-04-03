import {
  MapPin,
  Star,
  ArrowLeft,
  Clock,
  Phone,
  Mail,
  Utensils,
  Users,
  Heart,
} from "lucide-react";
import { Link, useParams } from "react-router";
import { useState, useEffect } from "react";
import { useT } from "../hooks/useT";
import { ImageWithFallback } from "../components/figma/ImageWithFallback";
import { Footer } from "../components/Footer";
import { Header } from "../components/Header";
import { getVenueById } from "../utils/dataService";
import type { Item } from "../utils/dataService";
import { VenueBadgeRow } from "../components/VenueBadgeRow";
import { splitOpeningHoursDisplaySegments } from "../utils/openingHoursDisplay";

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
        <Header />
        <div className="flex items-center justify-center h-[60vh]">
          <p className="text-2xl font-bold">{t('loading') || 'Loading'}...</p>
        </div>
        <Footer />
      </div>
    );
  }

  if (!restaurant) {
    return (
      <div style={{ background: "#FAFBFC", minHeight: "100vh" }}>
        <Header />
        <div className="flex items-center justify-center h-[60vh] flex-col gap-4">
          <p className="text-2xl font-bold">{t('venueNotFound') || 'Restaurant not found'}</p>
          <Link to="/food-and-drink" className="text-blue-600 hover:underline">
            {t('backToRestaurants') || 'Back to Restaurants'}
          </Link>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div style={{ background: "#FAFBFC", minHeight: "100vh" }}>
      <Header />
      <div
        style={{
          position: "relative",
          height: "350px",
          background:
            "linear-gradient(135deg, #8B6F47, #A0785A)",
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
              venue_type={restaurant.venue_type}
              cuisine={restaurant.cuisine}
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
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "2fr 1fr",
            gap: "40px",
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
            }}
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
              {language === 'en' && restaurant.description_en ? restaurant.description_en : restaurant.description}
            </p>

            <div style={{ marginTop: "auto" }}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "24px",
                }}
              >
                {restaurant.opening_hours && (
                  <div
                    style={{
                      background: "white",
                      padding: "24px",
                      borderRadius: "12px",
                      border: "1px solid #E5E9F0",
                    }}
                  >
                    <Clock
                      size={24}
                      style={{
                        color: "#00897B",
                        marginBottom: "12px",
                      }}
                    />
                    <h3
                      style={{
                        fontSize: "18px",
                        fontWeight: 700,
                        color: "#1A1D29",
                        marginBottom: "8px",
                      }}
                    >
                      {t("openingHours")}
                    </h3>
                    <div style={{ fontSize: "16px", color: "#6B7280" }}>
                      {splitOpeningHoursDisplaySegments(
                        language === 'en' && restaurant.opening_hours_en
                          ? restaurant.opening_hours_en
                          : restaurant.opening_hours
                      ).map((line, i) => (
                        <div key={i} style={{ marginTop: i > 0 ? 6 : 0 }}>
                          {line}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {restaurant.address && (
                  <div
                    style={{
                      background: "white",
                      padding: "24px",
                      borderRadius: "12px",
                      border: "1px solid #E5E9F0",
                    }}
                  >
                    <MapPin
                      size={24}
                      style={{
                        color: "#00897B",
                        marginBottom: "12px",
                      }}
                    />
                    <h3
                      style={{
                        fontSize: "18px",
                        fontWeight: 700,
                        color: "#1A1D29",
                        marginBottom: "8px",
                      }}
                    >
                      {t("address")}
                    </h3>
                    {restaurant.map_url ? (
                      <a
                        href={restaurant.map_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ fontSize: "16px", color: "#00897B", textDecoration: "none" }}
                        onMouseEnter={e => (e.currentTarget.style.textDecoration = "underline")}
                        onMouseLeave={e => (e.currentTarget.style.textDecoration = "none")}
                      >
                        {restaurant.address}
                      </a>
                    ) : (
                      <p style={{ fontSize: "16px", color: "#6B7280" }}>
                        {restaurant.address}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div>
            <div
              style={{
                background: "white",
                padding: "32px",
                borderRadius: "16px",
                border: "1px solid #E5E9F0",
                boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
                position: "sticky",
                top: "100px",
              }}
            >
              <h3
                style={{
                  fontSize: "24px",
                  fontWeight: 700,
                  color: "#1A1D29",
                  marginBottom: "24px",
                }}
              >
                {t("information")}
              </h3>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "20px",
                }}
              >
                {restaurant.phone && (
                  <>
                    <div>
                      <Phone
                        size={18}
                        style={{
                          color: "#00897B",
                          marginBottom: "8px",
                        }}
                      />
                      <p
                        style={{
                          fontSize: "14px",
                          color: "#6B7280",
                          marginBottom: "4px",
                        }}
                      >
                        {t("contact")}
                      </p>
                      <p
                        style={{
                          fontSize: "16px",
                          color: "#4B5563",
                        }}
                      >
                        {restaurant.phone}
                      </p>
                    </div>
                    <div
                      style={{
                        height: "1px",
                        background: "#E5E9F0",
                      }}
                    />
                  </>
                )}
                {restaurant.contact_email && (
                  <>
                    <div>
                      <Mail
                        size={18}
                        style={{
                          color: "#00897B",
                          marginBottom: "8px",
                        }}
                      />
                      <p
                        style={{
                          fontSize: "14px",
                          color: "#6B7280",
                          marginBottom: "4px",
                        }}
                      >
                        Email
                      </p>
                      <p
                        style={{
                          fontSize: "14px",
                          color: "#4B5563",
                          wordBreak: "break-word",
                        }}
                      >
                        {restaurant.contact_email}
                      </p>
                    </div>
                    <div
                      style={{
                        height: "1px",
                        background: "#E5E9F0",
                      }}
                    />
                  </>
                )}
                {restaurant.website && (
                  <div>
                    <p
                      style={{
                        fontSize: "14px",
                        color: "#6B7280",
                        marginBottom: "4px",
                      }}
                    >
                      Website
                    </p>
                    <a
                      href={restaurant.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        fontSize: "14px",
                        color: "#0E3DC5",
                        wordBreak: "break-word",
                      }}
                    >
                      {restaurant.website}
                    </a>
                  </div>
                )}
              </div>
              {restaurant.phone && (
                <button
                  onClick={() => window.location.href = `tel:${restaurant.phone}`}
                  style={{
                    width: "100%",
                    background: "#8B6F47",
                    color: "white",
                    border: "1px solid #6B7280",
                    padding: "16px",
                    borderRadius: "8px",
                    fontSize: "16px",
                    fontWeight: 700,
                    cursor: "pointer",
                    marginTop: "24px",
                  }}
                >
                  {t("callRestaurant") || 'Call Restaurant'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}