import {
  Calendar,
  MapPin,
  Heart,
  ExternalLink,
  Ticket,
  Users,
} from "lucide-react";
import { useParams } from "react-router";
import { useT } from "../hooks/useT";
import { useLanguage } from "../contexts/LanguageContext";
import { ImageWithFallback } from "../components/figma/ImageWithFallback";
import { useState, useEffect } from "react";
import * as eventService from "../utils/eventService";
import { Item } from "../utils/dataService";
import {
  VenueDetailTwoColumnGrid,
  VenueDetailMainColumn,
  VenueDetailRightColumn,
  VenueDetailBottomCardRow,
} from "../components/VenueDetailLayout";
import { getEventDetailTheme } from "../utils/categoryThemes";
import { getTopLevelPageCategory } from "../utils/eventPageCategory";

// Heart pulse animation keyframes (injected once)
const heartAnimStyle = document.createElement('style');
heartAnimStyle.textContent = `
@keyframes heartPulse {
  0% { transform: scale(1); }
  25% { transform: scale(1.35); }
  50% { transform: scale(0.9); }
  75% { transform: scale(1.15); }
  100% { transform: scale(1); }
}
.heart-pulse { animation: heartPulse 0.5s ease-in-out; }
`;
if (!document.getElementById('heart-pulse-style')) {
  heartAnimStyle.id = 'heart-pulse-style';
  document.head.appendChild(heartAnimStyle);
}

function isEventFree(event: Item): boolean {
  return /^(free|besplatn|gratis)/i.test(event.price || '') || /^(free|besplatn|gratis)/i.test(event.price_en || '');
}

export function EventDetailPage() {
  const { id } = useParams();
  const { t } = useT();
  const { language } = useLanguage();
  const [event, setEvent] = useState<Item | null>(null);
  const [loading, setLoading] = useState(true);
  const [interestCount, setInterestCount] = useState(0);
  const [hasClicked, setHasClicked] = useState(false);
  const [heartAnimating, setHeartAnimating] = useState(false);

  const theme = getEventDetailTheme(
    event ? getTopLevelPageCategory(event) : undefined
  );

  useEffect(() => {
    async function fetchEvent() {
      if (!id) return;
      
      setLoading(true);
      try {
        const eventData = await eventService.getEventById(id);
        setEvent(eventData);
      } catch (error) {
        console.error('Error fetching event:', error);
        setEvent(null);
      } finally {
        setLoading(false);
      }
    }
    
    fetchEvent();
  }, [id]);

  // Fetch interest count for free events
  useEffect(() => {
    if (!id || !event) return;
    const isFree = isEventFree(event);
    if (isFree) {
      eventService.getInterestCount(id).then(setInterestCount);
      // Check localStorage for previous click
      const clicked = localStorage.getItem(`interest_clicked:${id}`);
      if (clicked) setHasClicked(true);
    }
  }, [id, event]);

  if (loading) {
    return (
      <div style={{ background: "#FAFBFC", minHeight: "100vh" }}>
        <div className="max-w-7xl mx-auto px-4 py-16 text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-gray-200 border-t-blue-600"></div>
          <p className="mt-4 text-gray-600">
            {language === 'sr' ? 'Učitavanje...' : 'Loading...'}
          </p>
        </div>
      </div>
    );
  }

  if (!event) {
    return (
      <div style={{ background: "#FAFBFC", minHeight: "100vh" }}>
        <div className="max-w-7xl mx-auto px-4 py-16 text-center">
          <p className="text-gray-600 text-lg">
            {language === 'sr' ? 'Događaj nije pronađen' : 'Event not found'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div key={language} style={{ background: "#FAFBFC", minHeight: "100vh" }}>
      {/* Hero Section */}
      <div
        style={{
          position: "relative",
          height: "350px",
          background: theme.gradient,
        }}
      >
        <ImageWithFallback
          src={event.image || 'https://images.unsplash.com/photo-1540039155733-5bb30b53aa14?w=800'}
          alt={language === 'sr' ? event.title : (event.title_en || event.title)}
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
          {/* Back button removed */}
          
          <div>
            {(() => {
              const priceStr = (language === 'sr' ? (event.price || event.price_en) : (event.price_en || event.price)) || '';
              const isFree = /^(free|besplatn|gratis)/i.test(priceStr) || /^(free|besplatn|gratis)/i.test(event.price || '') || /^(free|besplatn|gratis)/i.test(event.price_en || '');
              return isFree ? (
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  background: theme.accent,
                  color: "white",
                  padding: "8px 16px",
                  borderRadius: "24px",
                  border: "1px solid #6B7280",
                  fontSize: "14px",
                  fontWeight: 700,
                  marginBottom: "16px",
                }}
              >
                <Ticket size={14} />
                {language === 'sr' ? 'Besplatno' : 'Free'}
              </div>
              ) : null;
            })()}
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
              {language === 'sr' ? event.title : (event.title_en || event.title)}
            </h1>
            <p
              style={{
                fontSize: "20px",
                color: "rgba(255,255,255,0.9)",
              }}
            >
              {eventService.translateEventType(event.event_type || event.page_slug || '', language)}
            </p>
          </div>
        </div>
      </div>

      {/* Content — same grid + bottom alignment as venue detail (FoodAndDrinkDetailPage) */}
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
                  <div
                    style={{
                      background: "white",
                      padding: "24px",
                      borderRadius: "12px",
                      border: "1px solid #E5E9F0",
                    }}
                  >
                    <Calendar
                      size={24}
                      style={{
                        color: theme.accent,
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
                      {t("dateAndTime")}
                    </h3>
                    <p
                      style={{
                        fontSize: "16px",
                        color: "#6B7280",
                        marginBottom: "4px",
                      }}
                    >
                      {event.start_at ? eventService.getRelativeDateLabel(event.start_at, language) : ""}
                    </p>
                    <p style={{ fontSize: "16px", color: "#6B7280" }}>
                      {event.start_at ? eventService.formatEventTime(event.start_at, event.end_at) : ""}
                    </p>
                  </div>

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
                        color: theme.accent,
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
                      {t("location")}
                    </h3>
                    <p
                      style={{
                        fontSize: "16px",
                        color: "#6B7280",
                        marginBottom: "4px",
                      }}
                    >
                      {event.venue_name || event.address || ""}
                    </p>
                    <p style={{ fontSize: "14px", color: "#9CA3AF" }}>
                      {event.venue_name && event.address ? event.address : ""}
                    </p>
                  </div>
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
                {t("aboutEvent")}
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
                {language === "sr" ? event.description : event.description_en || event.description}
              </p>
            </VenueDetailMainColumn>
          }
          rightColumn={
            <VenueDetailRightColumn>
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
                <div>
                  <Ticket
                    size={18}
                    style={{
                      color: theme.accent,
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
                    {t("price")}
                  </p>
                  <p
                    style={{
                      fontSize: "20px",
                      fontWeight: 700,
                      color: theme.accent,
                    }}
                  >
                    {(() => {
                      const p = language === 'sr' ? (event.price || event.price_en) : (event.price_en || event.price);
                      if (!p) return '';
                      if (/^(free|besplatn|gratis)/i.test(p) || /^(free|besplatn|gratis)/i.test(event.price || '') || /^(free|besplatn|gratis)/i.test(event.price_en || '')) {
                        return language === 'sr' ? 'Besplatno' : 'Free';
                      }
                      return p;
                    })()}
                  </p>
                </div>
                <div
                  style={{
                    height: "1px",
                    background: "#E5E9F0",
                  }}
                />
                <div>
                  <Users
                    size={18}
                    style={{
                      color: theme.accent,
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
                    {t("organizer")}
                  </p>
                  <p
                    style={{
                      fontSize: "16px",
                      fontWeight: 600,
                      color: "#1A1D29",
                    }}
                  >
                    {event.organizer_name || ''}
                  </p>
                </div>

                <div
                  style={{
                    height: "1px",
                    background: "#E5E9F0",
                  }}
                />

                <div>
                  <MapPin
                    size={18}
                    style={{
                      color: theme.accent,
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
                    {event.organizer_phone || event.phone || ''}
                  </p>
                </div>
              </div>
              {/* Conditional Button: Buy Ticket (paid) or Interested (free) */}
              {isEventFree(event) ? (
                <>
                  <button
                    style={{
                      width: "100%",
                      background: hasClicked ? '#6B7280' : theme.buttonBg,
                      color: "white",
                      border: "1px solid #6B7280",
                      padding: "16px",
                      borderRadius: "8px",
                      fontSize: "16px",
                      fontWeight: 700,
                      cursor: "pointer",
                      marginTop: "24px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "8px",
                      opacity: hasClicked ? 0.9 : 1,
                      transition: "all 0.2s ease",
                    }}
                    onClick={async () => {
                      if (!id) return;
                      setHeartAnimating(true);
                      setTimeout(() => setHeartAnimating(false), 500);
                      if (hasClicked) {
                        // Toggle OFF
                        setHasClicked(false);
                        localStorage.removeItem(`interest_clicked:${id}`);
                        const newCount = await eventService.decrementInterest(id);
                        setInterestCount(newCount);
                      } else {
                        // Toggle ON
                        setHasClicked(true);
                        localStorage.setItem(`interest_clicked:${id}`, 'true');
                        const newCount = await eventService.incrementInterest(id);
                        setInterestCount(newCount);
                      }
                    }}
                  >
                    <Heart size={18} fill={hasClicked ? "white" : "none"} className={heartAnimating ? 'heart-pulse' : ''} />
                    {hasClicked
                      ? (language === 'sr' ? 'Zainteresovan/a!' : 'Interested!')
                      : t("interested")
                    }
                  </button>
                  {interestCount > 0 && (
                    <p style={{
                      textAlign: "center",
                      fontSize: "14px",
                      color: "#6B7280",
                      marginTop: "8px",
                    }}>
                      <Heart size={12} style={{ display: "inline", verticalAlign: "middle", marginRight: "4px", color: theme.accent }} />
                      {interestCount} {t("peopleInterested")}
                    </p>
                  )}
                </>
              ) : event.ticket_link ? (
                <a
                  href={event.ticket_link}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    width: "100%",
                    background: theme.buttonBg,
                    color: "white",
                    border: "1px solid #6B7280",
                    padding: "16px",
                    borderRadius: "8px",
                    fontSize: "16px",
                    fontWeight: 700,
                    cursor: "pointer",
                    marginTop: "24px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "8px",
                    textDecoration: "none",
                    boxSizing: "border-box",
                  }}
                >
                  <ExternalLink size={18} />
                  {t("buyTicket")}
                </a>
              ) : (
                <button
                  style={{
                    width: "100%",
                    background: "#9CA3AF",
                    color: "white",
                    border: "1px solid #6B7280",
                    padding: "16px",
                    borderRadius: "8px",
                    fontSize: "16px",
                    fontWeight: 700,
                    cursor: "not-allowed",
                    marginTop: "24px",
                    opacity: 0.6,
                  }}
                  disabled
                >
                  <Ticket size={18} style={{ display: "inline", verticalAlign: "middle", marginRight: "6px" }} />
                  {language === 'sr' ? 'Link za kartu nije dostupan' : 'Ticket link not available'}
                </button>
              )}
            </div>
            </VenueDetailRightColumn>
          }
        />
      </div>
    </div>
  );
}