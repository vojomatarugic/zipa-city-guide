import { Clock, MapPin, Phone, Mail, Globe } from "lucide-react";
import type { ReactNode } from "react";
import { splitOpeningHoursDisplaySegments } from "../utils/openingHoursDisplay";

type VenueDetailT = (key: keyof typeof import("../utils/translations").translations) => string;

const MISSING = "—";

type VenueDetailMainColumnProps = {
  children: ReactNode;
  bottomCards: ReactNode;
};

/**
 * Left column: description grows; bottomCards stay on the same baseline as the right column info card.
 */
export function VenueDetailMainColumn({ children, bottomCards }: VenueDetailMainColumnProps) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignSelf: "stretch",
        minHeight: 0,
      }}
    >
      {children}
      <div style={{ flex: 1, minHeight: "1px" }} aria-hidden />
      {bottomCards}
    </div>
  );
}

type VenueDetailRightColumnProps = {
  children: ReactNode;
};

/** Pushes the sticky info card to the bottom so it aligns with Radno vrijeme / Adresa row. */
export function VenueDetailRightColumn({ children }: VenueDetailRightColumnProps) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "flex-end",
        alignSelf: "stretch",
        minHeight: 0,
      }}
    >
      {children}
    </div>
  );
}

type VenueDetailTwoColumnGridProps = {
  mainColumn: ReactNode;
  rightColumn: ReactNode;
};

export function VenueDetailTwoColumnGrid({ mainColumn, rightColumn }: VenueDetailTwoColumnGridProps) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "2fr 1fr",
        gap: "40px",
        alignItems: "stretch",
      }}
    >
      {mainColumn}
      {rightColumn}
    </div>
  );
}

/** Two-up row for Radno vrijeme + Adresa (or event date/location) aligned with the info column. */
export function VenueDetailBottomCardRow({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: "24px",
      }}
    >
      {children}
    </div>
  );
}

type VenueDetailHoursCardProps = {
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
    language === "en" && openingHoursTextEn?.trim()
      ? openingHoursTextEn
      : openingHoursText;
  const segments = raw?.trim()
    ? splitOpeningHoursDisplaySegments(raw)
    : [];

  return (
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
          color: accentColor,
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
        {segments.length > 0 ? (
          segments.map((line, i) => (
            <div key={i} style={{ marginTop: i > 0 ? 6 : 0 }}>
              {line}
            </div>
          ))
        ) : (
          <span>{MISSING}</span>
        )}
      </div>
    </div>
  );
}

type VenueDetailAddressCardProps = {
  address?: string | null;
  mapUrl?: string | null;
  t: VenueDetailT;
  accentColor: string;
};

export function VenueDetailAddressCard({ address, mapUrl, t, accentColor }: VenueDetailAddressCardProps) {
  const line = address?.trim() || MISSING;

  return (
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
          color: accentColor,
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
      {mapUrl && address?.trim() ? (
        <a
          href={mapUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{ fontSize: "16px", color: accentColor, textDecoration: "none" }}
          onMouseEnter={(e) => (e.currentTarget.style.textDecoration = "underline")}
          onMouseLeave={(e) => (e.currentTarget.style.textDecoration = "none")}
        >
          {address}
        </a>
      ) : (
        <p style={{ fontSize: "16px", color: "#6B7280", margin: 0 }}>{line}</p>
      )}
    </div>
  );
}

type VenueDetailInfoCardProps = {
  phone?: string | null;
  contactPhone?: string | null;
  email?: string | null;
  website?: string | null;
  t: VenueDetailT;
  accentColor: string;
  callButtonLabel: string;
  ctaBackground: string;
  ctaBorder: string;
};

export function VenueDetailInfoCard({
  phone,
  contactPhone,
  email,
  website,
  t,
  accentColor,
  callButtonLabel,
  ctaBackground,
  ctaBorder,
}: VenueDetailInfoCardProps) {
  const phoneDisplay = (phone?.trim() || contactPhone?.trim() || "").trim() || MISSING;
  const canCall = phoneDisplay !== MISSING && /\d/.test(phoneDisplay);
  const telHref = canCall ? `tel:${phoneDisplay.replace(/\s/g, "")}` : "";
  const emailDisplay = email?.trim() || MISSING;
  const websiteTrim = website?.trim() || "";
  const hasWebsite = Boolean(websiteTrim);

  return (
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
          <p
            style={{
              fontSize: "16px",
              color: "#4B5563",
            }}
          >
            {phoneDisplay}
          </p>
        </div>
        <div
          style={{
            height: "1px",
            background: "#E5E9F0",
          }}
        />
        <div>
          <Mail
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
            {t("email")}
          </p>
          <p
            style={{
              fontSize: "14px",
              color: "#4B5563",
              wordBreak: "break-word",
            }}
          >
            {emailDisplay}
          </p>
        </div>
        <div
          style={{
            height: "1px",
            background: "#E5E9F0",
          }}
        />
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
              href={websiteTrim}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                fontSize: "14px",
                color: "#0E3DC5",
                wordBreak: "break-word",
              }}
            >
              {websiteTrim}
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
              {MISSING}
            </p>
          )}
        </div>
      </div>
      {canCall && (
        <button
          type="button"
          onClick={() => {
            window.location.href = telHref;
          }}
          style={{
            width: "100%",
            background: ctaBackground,
            color: "white",
            border: ctaBorder,
            padding: "16px",
            borderRadius: "8px",
            fontSize: "16px",
            fontWeight: 700,
            cursor: "pointer",
            marginTop: "24px",
          }}
        >
          {callButtonLabel}
        </button>
      )}
    </div>
  );
}
