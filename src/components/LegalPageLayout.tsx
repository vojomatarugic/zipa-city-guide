import type { CSSProperties, ReactNode } from "react";
import { BACKGROUNDS, BORDERS, BRAND, TEXT } from "../utils/colors";

type LegalPageLayoutProps = {
  title: ReactNode;
  lastUpdatedLabel: ReactNode;
  lastUpdatedValue: ReactNode;
  intro: ReactNode;
  children: ReactNode;
};

export const legalPageStyles: Record<string, CSSProperties> = {
  page: {
    background: BACKGROUNDS.white,
  },
  title: {
    fontSize: "42px",
    fontWeight: 700,
    background: "linear-gradient(135deg, #60A5FA 0%, #0E3DC5 100%)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
    backgroundClip: "text",
  },
  lastUpdated: {
    fontSize: "14px",
    color: TEXT.secondary,
  },
  lastUpdatedLabel: {
    fontWeight: 400,
  },
  lastUpdatedValue: {
    fontWeight: 600,
  },
  introBox: {
    background: BACKGROUNDS.lightGray,
    border: `1px solid ${BORDERS.light}`,
    borderRadius: "12px",
    padding: "24px",
    minHeight: "132px",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
  },
  sectionTitle: {
    fontSize: "24px",
    fontWeight: 600,
    color: BRAND.primary,
  },
  subsectionTitle: {
    fontSize: "18px",
    fontWeight: 600,
    color: TEXT.primary,
  },
  bodyText: {
    fontSize: "16px",
    lineHeight: "1.7",
    color: TEXT.primary,
  },
  list: {
    fontSize: "16px",
    lineHeight: "1.7",
    color: TEXT.primary,
    listStyleType: "disc",
  },
  inlineLink: {
    color: BRAND.primary,
  },
};

type LegalBlockProps = {
  children: ReactNode;
};

export function LegalSection({ children }: LegalBlockProps) {
  return <section className="mb-8">{children}</section>;
}

export function LegalSectionTitle({ children }: LegalBlockProps) {
  return (
    <h2 className="mb-4" style={legalPageStyles.sectionTitle}>
      {children}
    </h2>
  );
}

export function LegalSubsectionTitle({ children }: LegalBlockProps) {
  return (
    <h3 className="mb-3" style={legalPageStyles.subsectionTitle}>
      {children}
    </h3>
  );
}

export function LegalParagraph({ children }: LegalBlockProps) {
  return <p style={legalPageStyles.bodyText}>{children}</p>;
}

export function LegalParagraphSpaced({ children }: LegalBlockProps) {
  return (
    <p className="mb-3" style={legalPageStyles.bodyText}>
      {children}
    </p>
  );
}

export function LegalParagraphWideGap({ children }: LegalBlockProps) {
  return (
    <p className="mb-4" style={legalPageStyles.bodyText}>
      {children}
    </p>
  );
}

export function LegalList({ children }: LegalBlockProps) {
  return (
    <ul className="ml-6 mb-3" style={legalPageStyles.list}>
      {children}
    </ul>
  );
}

export function LegalListSpacious({ children }: LegalBlockProps) {
  return (
    <ul className="ml-6 mb-4" style={legalPageStyles.list}>
      {children}
    </ul>
  );
}

type LegalInlineLinkProps = {
  href: string;
  children: ReactNode;
};

export function LegalInlineLink({ href, children }: LegalInlineLinkProps) {
  return (
    <a href={href} style={legalPageStyles.inlineLink}>
      {children}
    </a>
  );
}

export function LegalPageLayout({
  title,
  lastUpdatedLabel,
  lastUpdatedValue,
  intro,
  children,
}: LegalPageLayoutProps) {
  return (
    <div className="min-h-screen" style={legalPageStyles.page}>
      <section className="py-16">
        <div className="max-w-[800px] mx-auto px-4">
          <h1 className="text-center mb-8" style={legalPageStyles.title}>
            {title}
          </h1>

          <p className="text-center mb-8" style={legalPageStyles.lastUpdated}>
            <span style={legalPageStyles.lastUpdatedLabel}>
              {lastUpdatedLabel}{" "}
            </span>
            <span style={legalPageStyles.lastUpdatedValue}>
              {lastUpdatedValue}
            </span>
          </p>

          <div className="mb-8" style={legalPageStyles.introBox}>
            {intro}
          </div>

          {children}
        </div>
      </section>
    </div>
  );
}
