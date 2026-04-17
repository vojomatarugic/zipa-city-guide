import type { CSSProperties } from "react";
import {
  Clock,
  MapPin,
  Phone,
  Mail,
  Globe,
  ExternalLink,
  User,
} from "lucide-react";
import { splitOpeningHoursDisplaySegments } from "../utils/openingHoursDisplay";

type VenueDetailT = (key: keyof typeof import("../utils/translations").translations) => string;

const DASH = "-";

const CARD_SHELL: CSSProperties = {
  background: "white",
  padding: "24px",
  borderRadius: "12px",
  border: "1px solid #E5E9F0",
};

function isBlank(s: string | null | undefined): boolean {
  return s == null || String(s).trim() === "";
}

export function getGoogleMapsHref(address?: string | null, mapUrl?: string | null): string {
  const direct = (mapUrl || "").trim();
  if (direct) return direct;
  const query = (address || "").trim();
  return query
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`
    : "";
}

export type VenueDetailUnifiedInfoCardProps = {
  contactName?: string | null;
  phone?: string | null;
  contactPhone?: string | null;
  email?: string | null;
  website?: string | null;
  /** Used only for map CTA when no phone/website */
  address?: string | null;
  city?: string | null;
  mapUrl?: string | null;
  t: VenueDetailT;
  accentColor: string;
  buttonBg: string;
  buttonBorder: string;
  callButtonLabel: string;
};

export function VenueDetailUnifiedInfoCard({
  contactName,
  phone,
  contactPhone,
  email,
  website,
  address,
  city,
  mapUrl,
  t,
  accentColor,
  buttonBg,
  buttonBorder,
  callButtonLabel,
}: VenueDetailUnifiedInfoCardProps) {
  const phoneRaw = (phone?.trim() || contactPhone?.trim() || "").trim();
  const canCall = !isBlank(phoneRaw) && /\d/.test(phoneRaw);
  const telHref = canCall ? `tel:${phoneRaw.replace(/\s/g, "")}` : "";

  const emailRaw = (email || "").trim();
  const mailtoHref = emailRaw ? `mailto:${emailRaw}` : "";

  const websiteRaw = (website || "").trim();
  const hasWebsite = Boolean(websiteRaw);

  const addressLine = (address || "").trim();
  const cityLine = (city || "").trim();
  const addressLines =
    addressLine && cityLine
      ? [addressLine, cityLine]
      : addressLine
        ? [addressLine]
        : cityLine
          ? [cityLine]
          : [];
  const addressForMap = addressLines.join(", ");
  const mapHref = getGoogleMapsHref(addressForMap || undefined, mapUrl);
  const hasMapHref = Boolean(mapHref);

  const phoneDisplay = isBlank(phoneRaw) ? DASH : phoneRaw;

  const contactNameDisplay = isBlank(contactName) ? DASH : contactName!.trim();

  const showMapCta = !canCall && !hasWebsite && hasMapHref;

  return (
    <aside
      className="flex h-full min-h-0 min-w-0 flex-col"
      style={CARD_SHELL}
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
        className="flex min-h-0 flex-1 flex-col"
        style={{
          gap: "20px",
        }}
      >
        <div>
          <User
            size={18}
            style={{
              color: accentColor,
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
            {t("name")}
          </p>
          <p
            style={{
              fontSize: "16px",
              fontWeight: contactNameDisplay === DASH ? 400 : 600,
              color: contactNameDisplay === DASH ? "#4B5563" : "#1A1D29",
              margin: 0,
            }}
          >
            {contactNameDisplay}
          </p>
        </div>

        <div style={{ height: "1px", background: "#E5E9F0" }} />

        <div>
          <Phone
            size={18}
            style={{
              color: accentColor,
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
            {t("contact")} / {t("phone")}
          </p>
          {canCall ? (
            <a
              href={telHref}
              style={{
                fontSize: "16px",
                color: accentColor,
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
              {phoneDisplay}
            </a>
          ) : (
            <p style={{ fontSize: "16px", color: "#4B5563", margin: 0 }}>
              {phoneDisplay}
            </p>
          )}
        </div>

        <div style={{ height: "1px", background: "#E5E9F0" }} />

        <div>
          <Mail size={18} style={{ color: accentColor, marginBottom: "8px" }} />
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
                color: accentColor,
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
              {emailRaw}
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
              {DASH}
            </p>
          )}
        </div>

        <div style={{ height: "1px", background: "#E5E9F0" }} />

        <div>
          <Globe
            size={18}
            style={{
              color: accentColor,
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
            Website
          </p>
          {hasWebsite ? (
            <a
              href={websiteRaw}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                fontSize: "14px",
                color: accentColor,
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
              {websiteRaw}
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
              {DASH}
            </p>
          )}
        </div>
      </div>

      {(canCall || hasWebsite || showMapCta) ? (
      <div className="mt-auto shrink-0 pt-6">
        {canCall ? (
          <button
            type="button"
            onClick={() => {
              window.location.href = telHref;
            }}
            style={{
              width: "100%",
              background: buttonBg,
              color: "white",
              border: buttonBorder,
              padding: "16px",
              borderRadius: "8px",
              fontSize: "16px",
              fontWeight: 700,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
            }}
          >
            <Phone size={18} />
            {callButtonLabel}
          </button>
        ) : hasWebsite ? (
          <a
            href={websiteRaw}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              width: "100%",
              background: buttonBg,
              color: "white",
              border: buttonBorder,
              padding: "16px",
              borderRadius: "8px",
              fontSize: "16px",
              fontWeight: 700,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              textDecoration: "none",
              boxSizing: "border-box",
            }}
          >
            <ExternalLink size={18} />
            {t("websiteLink")}
          </a>
        ) : showMapCta ? (
          <a
            href={mapHref}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              width: "100%",
              background: buttonBg,
              color: "white",
              border: buttonBorder,
              padding: "16px",
              borderRadius: "8px",
              fontSize: "16px",
              fontWeight: 700,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              textDecoration: "none",
              boxSizing: "border-box",
            }}
          >
            <MapPin size={18} />
            {t("openMap")}
          </a>
        ) : null}
      </div>
      ) : null}
    </aside>
  );
}

export type VenueDetailHoursCardProps = {
  openingHoursText?: string | null;
  openingHoursTextEn?: string | null;
  language: string;
  t: VenueDetailT;
  accentColor: string;
};

export function VenueDetailHoursCard({
  openingHoursText,
  openingHoursTextEn,
  language,
  t,
  accentColor,
}: VenueDetailHoursCardProps) {
  const raw =
    language === "en" && !isBlank(openingHoursTextEn)
      ? openingHoursTextEn!
      : openingHoursText;
  const segments = !isBlank(raw)
    ? splitOpeningHoursDisplaySegments(raw!.trim())
    : [];

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col" style={CARD_SHELL}>
      <Clock
        size={18}
        style={{
          color: accentColor,
          marginBottom: "8px",
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
      <div
        className="min-h-0 flex-1"
        style={{ fontSize: "16px", color: "#4B5563", lineHeight: 1.5 }}
      >
        {segments.length > 0 ? (
          segments.map((line, i) => (
            <div key={i} style={{ marginTop: i > 0 ? 6 : 0 }}>
              {line}
            </div>
          ))
        ) : (
          <span>{DASH}</span>
        )}
      </div>
    </div>
  );
}

export type VenueDetailAddressCardProps = {
  address?: string | null;
  city?: string | null;
  mapUrl?: string | null;
  t: VenueDetailT;
  accentColor: string;
};

export function VenueDetailAddressCard({
  address,
  city,
  mapUrl,
  t,
  accentColor,
}: VenueDetailAddressCardProps) {
  const addressLine = (address || "").trim();
  const cityLine = (city || "").trim();
  const lines =
    addressLine && cityLine
      ? [addressLine, cityLine]
      : addressLine
        ? [addressLine]
        : cityLine
          ? [cityLine]
          : [];
  const hasText = lines.length > 0;
  const mapHref = getGoogleMapsHref(lines.join(", ") || undefined, mapUrl);
  const hasMapHref = Boolean(mapHref);

  const valueTypography = {
    fontSize: "16px" as const,
    fontWeight: 700 as const,
    color: "#1A1D29",
    margin: 0,
    lineHeight: 1.35,
    wordBreak: "break-word" as const,
  };

  const linesBlock =
    !hasText ? (
      <p style={{ ...valueTypography, fontWeight: 400, color: "#4B5563" }}>
        {DASH}
      </p>
    ) : hasMapHref ? (
      <a
        href={mapHref}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "4px",
          textDecoration: "none",
          outline: "none",
          color: "#1A1D29",
          fontSize: "16px",
          fontWeight: 700,
          lineHeight: 1.35,
          wordBreak: "break-word",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.textDecoration = "underline";
          e.currentTarget.style.color = accentColor;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.textDecoration = "none";
          e.currentTarget.style.color = "#1A1D29";
        }}
      >
        {addressLine ? <span>{addressLine}</span> : null}
        {cityLine ? <span>{cityLine}</span> : null}
      </a>
    ) : (
      <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
        {addressLine ? <p style={valueTypography}>{addressLine}</p> : null}
        {cityLine ? <p style={valueTypography}>{cityLine}</p> : null}
      </div>
    );

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col" style={CARD_SHELL}>
      <MapPin
        size={18}
        style={{
          color: accentColor,
          marginBottom: "8px",
          flexShrink: 0,
        }}
      />
      <h3
        style={{
          fontSize: "18px",
          fontWeight: 700,
          color: "#1A1D29",
          margin: 0,
          marginBottom: "8px",
          flexShrink: 0,
        }}
      >
        {t("address")}
      </h3>
      <div className="min-h-0 min-w-0 shrink-0">{linesBlock}</div>
    </div>
  );
}
