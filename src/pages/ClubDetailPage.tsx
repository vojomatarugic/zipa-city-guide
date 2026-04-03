import {
  MapPin,
  Music,
  ArrowLeft,
  Clock,
  Phone,
  Mail,
  Users,
} from "lucide-react";
import { Link, useParams } from "react-router";
import { useState, useEffect } from "react";
import { useT } from "../hooks/useT";
import { ImageWithFallback } from "../components/figma/ImageWithFallback";
import { Footer } from "../components/Footer";
import { Header } from "../components/Header";
import { getVenueById } from "../utils/dataService";
import type { Item } from "../utils/dataService";
import { splitOpeningHoursDisplaySegments } from "../utils/openingHoursDisplay";

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
        <Header />
        <div className="flex items-center justify-center h-[60vh]">
          <p className="text-2xl font-bold">{t('loading') || 'Loading'}...</p>
        </div>
        <Footer />
      </div>
    );
  }

  if (!club) {
    return (
      <div style={{ background: "#FAFBFC", minHeight: "100vh" }}>
        <Header />
        <div className="flex items-center justify-center h-[60vh] flex-col gap-4">
          <p className="text-2xl font-bold">{t('clubNotFound') || 'Club not found'}</p>
          <Link to="/clubs" className="text-blue-600 hover:underline">
            {t('backToClubs') || 'Back to Clubs'}
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
          background: "linear-gradient(135deg, #7B1FA2, #9C27B0)",
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
            <p
              style={{
                fontSize: "20px",
                color: "rgba(255,255,255,0.9)",
              }}
            >
              {t('nightlife')}
            </p>
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
              {t("aboutClub") || 'About'}
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
              {language === 'en' && club.description_en ? club.description_en : club.description}
            </p>

            <div style={{ marginTop: "auto" }}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "24px",
                }}
              >
                {club.opening_hours && (
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
                        color: "#7B1FA2",
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
                        language === 'en' && club.opening_hours_en ? club.opening_hours_en : club.opening_hours
                      ).map((line, i) => (
                        <div key={i} style={{ marginTop: i > 0 ? 6 : 0 }}>
                          {line}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {club.address && (
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
                        color: "#7B1FA2",
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
                    {club.map_url ? (
                      <a
                        href={club.map_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ fontSize: "16px", color: "#7B1FA2", textDecoration: "none" }}
                        onMouseEnter={e => (e.currentTarget.style.textDecoration = "underline")}
                        onMouseLeave={e => (e.currentTarget.style.textDecoration = "none")}
                      >
                        {club.address}
                      </a>
                    ) : (
                      <p style={{ fontSize: "16px", color: "#6B7280" }}>
                        {club.address}
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
                {club.phone && (
                  <>
                    <div>
                      <Phone
                        size={18}
                        style={{
                          color: "#7B1FA2",
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
                      {club.contact_name && (
                        <p
                          style={{
                            fontSize: "16px",
                            color: "#1A1D29",
                            fontWeight: 600,
                            marginBottom: "2px",
                          }}
                        >
                          {club.contact_name}
                        </p>
                      )}
                      <p
                        style={{
                          fontSize: "16px",
                          color: "#4B5563",
                        }}
                      >
                        {club.phone}
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
                {club.contact_email && (
                  <>
                    <div>
                      <Mail
                        size={18}
                        style={{
                          color: "#7B1FA2",
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
                        {club.contact_email}
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
                {club.website && (
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
                      href={club.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        fontSize: "14px",
                        color: "#0E3DC5",
                        wordBreak: "break-word",
                      }}
                    >
                      {club.website}
                    </a>
                  </div>
                )}
              </div>
              {club.phone && (
                <button
                  onClick={() => window.location.href = `tel:${club.phone}`}
                  style={{
                    width: "100%",
                    background: "#7B1FA2",
                    color: "white",
                    border: "none",
                    padding: "16px",
                    borderRadius: "8px",
                    fontSize: "16px",
                    fontWeight: 700,
                    cursor: "pointer",
                    marginTop: "24px",
                  }}
                >
                  {t("callClub") || 'Call Club'}
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