import {
  Clock,
  Heart,
  ExternalLink,
  Ticket,
  Users,
  Phone,
  Mail,
  MapPin,
} from "lucide-react";
import { useParams } from "react-router";
import { useT } from "../hooks/useT";
import { useLanguage } from "../contexts/LanguageContext";
import { ImageWithFallback } from "../components/figma/ImageWithFallback";
import { useState, useEffect } from "react";
import * as eventService from "../utils/eventService";
import { Item } from "../utils/dataService";
import { getEventDetailTheme } from "../utils/categoryThemes";
import { getTopLevelPageCategory } from "../utils/eventPageCategory";
import { getGoogleMapsHref } from "../components/VenueDetailLayout";

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
  return /^(free|besplatn|gratis)/i.test(event.price || '');
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

  useEffect(() => {
    if (!id || !event) return;
    const isFree = isEventFree(event);
    if (isFree) {
      eventService.getInterestCount(id).then(setInterestCount);
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

  const title =
    language === 'sr' ? event.title : (event.title_en || event.title);
  const description =
    language === "sr"
      ? event.description
      : event.description_en || event.description;
  const groupedSchedule = eventService.getGroupedEventSchedule(
    event,
    language === "sr" ? "sr" : "en"
  );
  const addressLine = (event.address || "").trim();
  const venueLine = (event.venue_name || "").trim();
  const cityLine = (event.city || "").trim();
  const emailDisplay =
    (event.organizer_email || event.contact_email || "").trim();
  const mailtoHref = emailDisplay ? `mailto:${emailDisplay}` : "";
  const addressForMap =
    addressLine && cityLine
      ? `${addressLine}, ${cityLine}`
      : addressLine || cityLine || "";
  const mapHref = getGoogleMapsHref(
    addressForMap.trim() || undefined,
    event.map_url
  );

  return (
    <div key={language} style={{ background: "#FAFBFC", minHeight: "100vh" }}>
      {/* Top image — main visual anchor */}
      <div
        className="mx-auto w-full max-w-[1280px] px-5 pt-8"
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
              event.image ||
              "https://images.unsplash.com/photo-1540039155733-5bb30b53aa14?w=1200"
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
      </div>

      <div
        className="mx-auto max-w-[1280px] px-5 pb-12 pt-8"
        style={{ boxSizing: "border-box" }}
      >
        <div className="grid grid-cols-1 items-stretch gap-6 lg:grid-cols-3">
          <div className="col-span-1 flex h-full min-h-0 min-w-0 flex-col lg:col-span-2">
            <div className="flex min-h-0 flex-1 flex-col">
              {venueLine ? (
                <p
                  style={{
                    fontSize: "13px",
                    fontWeight: 600,
                    letterSpacing: "0.1em",
                    color: theme.accent,
                    margin: 0,
                    marginBottom: "10px",
                  }}
                >
                  {venueLine}
                </p>
              ) : null}
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

              <div className="mt-auto max-w-[52rem]">
                <div
                  className="flex h-full min-h-0 min-w-0 flex-col"
                  style={{
                    background: "white",
                    padding: "24px",
                    borderRadius: "12px",
                    border: "1px solid #E5E9F0",
                  }}
                >
                  <Clock
                    size={18}
                    style={{
                      color: theme.accent,
                      marginBottom: "8px",
                    }}
                  />
                  <h3
                    style={{
                      fontSize: "18px",
                      fontWeight: 700,
                      color: "#1A1D29",
                      margin: 0,
                      marginBottom: "8px",
                    }}
                  >
                    {t("dateAndTime")}
                  </h3>
                  <div
                    className="min-h-0 flex-1"
                    style={{
                      fontSize: "16px",
                      color: "#4B5563",
                      lineHeight: 1.5,
                    }}
                  >
                    {groupedSchedule.length === 0 ? (
                      <span>-</span>
                    ) : (
                      <ul className="m-0 list-none space-y-0 p-0">
                        {groupedSchedule.map((row, idx) => (
                          <li
                            key={row.dayKey}
                            className="flex flex-col gap-2 md:flex-row md:items-baseline md:gap-6"
                            style={{
                              paddingTop: idx > 0 ? "14px" : 0,
                              marginTop: idx > 0 ? "14px" : 0,
                              borderTop:
                                idx > 0 ? "1px solid #E5E9F0" : undefined,
                            }}
                          >
                            <div className="min-w-0 shrink-0 md:max-w-[min(22rem,46%)] md:flex-[0_1_auto]">
                              <p
                                style={{
                                  fontSize: "16px",
                                  color: "#374151",
                                  margin: 0,
                                  fontWeight: 600,
                                  lineHeight: 1.45,
                                }}
                              >
                                {row.weekdayDateLabel}
                              </p>
                            </div>
                            <div className="min-w-0 flex-1">
                              <div
                                className="flex flex-wrap gap-x-5 gap-y-2"
                                style={{
                                  fontSize: "16px",
                                  color: "#4B5563",
                                  fontWeight: 600,
                                  lineHeight: 1.5,
                                }}
                              >
                                {row.timeLabels.map((label, ti) => (
                                  <span
                                    key={`${row.dayKey}-t-${ti}`}
                                    className="tabular-nums tracking-tight"
                                    style={{ fontVariantNumeric: "tabular-nums" }}
                                  >
                                    {label}
                                  </span>
                                ))}
                              </div>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="h-full min-h-0 min-w-0">
            <aside
              className="flex h-full min-h-0 min-w-0 flex-col"
              style={{
                background: "white",
                padding: "24px",
                borderRadius: "12px",
                border: "1px solid #E5E9F0",
              }}
            >
            <h3
              style={{
                fontSize: "18px",
                fontWeight: 700,
                color: "#1A1D29",
                marginBottom: "16px",
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
                    fontSize: "18px",
                    fontWeight: 700,
                    color: theme.accent,
                  }}
                >
                  {(() => {
                    const raw = event.price;
                    if (
                      raw == null ||
                      (typeof raw === "string" && raw.trim() === "")
                    ) {
                      return "-";
                    }
                    const p = eventService.formatPrice(raw, language);
                    if (!p || String(p).trim() === "") return "-";
                    if (/^(free|besplatn|gratis)/i.test(p)) {
                      return language === "sr" ? "Besplatno" : "Free";
                    }
                    return p;
                  })()}
                </p>
              </div>

              <div style={{ height: "1px", background: "#E5E9F0" }} />

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
                    margin: 0,
                  }}
                >
                  {(event.organizer_name || "").trim() || "-"}
                </p>
              </div>

              <div style={{ height: "1px", background: "#E5E9F0" }} />

              <div>
                <Phone
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
                {(() => {
                  const phone = (
                    event.organizer_phone ||
                    event.phone ||
                    ""
                  ).trim();
                  const telHref = phone ? `tel:${phone.replace(/\s/g, "")}` : "";
                  return telHref ? (
                    <a
                      href={telHref}
                      style={{
                        fontSize: "16px",
                        color: theme.accent,
                        textDecoration: "none",
                        outline: "none",
                      }}
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.textDecoration = "underline")
                      }
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.textDecoration = "none")
                      }
                      onFocus={(e) =>
                        (e.currentTarget.style.textDecoration = "underline")
                      }
                      onBlur={(e) =>
                        (e.currentTarget.style.textDecoration = "none")
                      }
                    >
                      {phone}
                    </a>
                  ) : (
                    <p style={{ fontSize: "16px", color: "#4B5563", margin: 0 }}>
                      {phone || "-"}
                    </p>
                  );
                })()}
              </div>

              <div style={{ height: "1px", background: "#E5E9F0" }} />

              <div>
                <Mail
                  size={18}
                  style={{ color: theme.accent, marginBottom: "8px" }}
                />
                <p
                  style={{
                    fontSize: "14px",
                    color: "#6B7280",
                    marginBottom: "4px",
                  }}
                >
                  {t("email")}
                </p>
                {mailtoHref ? (
                  <a
                    href={mailtoHref}
                    style={{
                      fontSize: "14px",
                      color: theme.accent,
                      textDecoration: "none",
                      wordBreak: "break-word",
                      outline: "none",
                    }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.textDecoration = "underline")
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.textDecoration = "none")
                    }
                  >
                    {emailDisplay}
                  </a>
                ) : (
                  <p
                    style={{
                      fontSize: "14px",
                      color: "#4B5563",
                      margin: 0,
                      wordBreak: "break-word",
                    }}
                  >
                    -
                  </p>
                )}
              </div>

              <div style={{ height: "1px", background: "#E5E9F0" }} />

              <div>
                <MapPin
                  size={18}
                  style={{ color: theme.accent, marginBottom: "8px" }}
                />
                <p
                  style={{
                    fontSize: "14px",
                    color: "#6B7280",
                    marginBottom: "4px",
                  }}
                >
                  {t("address")}
                </p>
                {(() => {
                  const hasAddrText = Boolean(addressLine || cityLine);
                  if (!hasAddrText) {
                    return (
                      <p
                        style={{
                          fontSize: "16px",
                          color: "#4B5563",
                          margin: 0,
                        }}
                      >
                        -
                      </p>
                    );
                  }
                  if (mapHref) {
                    return (
                      <a
                        href={mapHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: "4px",
                          fontSize: "16px",
                          fontWeight: 600,
                          color: theme.accent,
                          textDecoration: "none",
                          wordBreak: "break-word",
                          outline: "none",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.textDecoration = "underline";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.textDecoration = "none";
                        }}
                      >
                        {addressLine ? <span>{addressLine}</span> : null}
                        {cityLine ? <span>{cityLine}</span> : null}
                      </a>
                    );
                  }
                  return (
                    <div
                      style={{ display: "flex", flexDirection: "column", gap: "4px" }}
                    >
                      {addressLine ? (
                        <p
                          style={{
                            fontSize: "16px",
                            fontWeight: 600,
                            color: "#1A1D29",
                            margin: 0,
                            lineHeight: 1.35,
                            wordBreak: "break-word",
                          }}
                        >
                          {addressLine}
                        </p>
                      ) : null}
                      {cityLine ? (
                        <p
                          style={{
                            fontSize: "16px",
                            fontWeight: 600,
                            color: "#1A1D29",
                            margin: 0,
                            lineHeight: 1.35,
                            wordBreak: "break-word",
                          }}
                        >
                          {cityLine}
                        </p>
                      ) : null}
                    </div>
                  );
                })()}
              </div>
            </div>

            {isEventFree(event) ? (
              <>
                <button
                  style={{
                    width: "100%",
                    background: hasClicked ? "#6B7280" : theme.buttonBg,
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
                  type="button"
                  onClick={async () => {
                    if (!id) return;
                    setHeartAnimating(true);
                    setTimeout(() => setHeartAnimating(false), 500);
                    if (hasClicked) {
                      setHasClicked(false);
                      localStorage.removeItem(`interest_clicked:${id}`);
                      const newCount = await eventService.decrementInterest(id);
                      setInterestCount(newCount);
                    } else {
                      setHasClicked(true);
                      localStorage.setItem(`interest_clicked:${id}`, "true");
                      const newCount = await eventService.incrementInterest(id);
                      setInterestCount(newCount);
                    }
                  }}
                >
                  <Heart
                    size={18}
                    fill={hasClicked ? "white" : "none"}
                    className={heartAnimating ? "heart-pulse" : ""}
                  />
                  {hasClicked
                    ? language === "sr"
                      ? "Zainteresovan/a!"
                      : "Interested!"
                    : t("interested")}
                </button>
                {interestCount > 0 && (
                  <p
                    style={{
                      textAlign: "center",
                      fontSize: "14px",
                      color: "#6B7280",
                      marginTop: "8px",
                    }}
                  >
                    <Heart
                      size={12}
                      style={{
                        display: "inline",
                        verticalAlign: "middle",
                        marginRight: "4px",
                        color: theme.accent,
                      }}
                    />
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
                type="button"
                disabled
              >
                <Ticket
                  size={18}
                  style={{
                    display: "inline",
                    verticalAlign: "middle",
                    marginRight: "6px",
                  }}
                />
                {language === "sr"
                  ? "Link za kartu nije dostupan"
                  : "Ticket link not available"}
              </button>
            )}
          </aside>
          </div>
        </div>
      </div>
    </div>
  );
}
