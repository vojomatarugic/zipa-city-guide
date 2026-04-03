import { useT } from "../hooks/useT";
import { useLanguage } from "../contexts/LanguageContext";
import { useSEO } from "../hooks/useSEO";
import { getBreadcrumbSchema } from "../utils/structuredData";
import { Header } from "../components/Header";
import { Footer } from "../components/Footer";
import {
  BRAND,
  TEXT,
  BACKGROUNDS,
  BORDERS,
} from "../utils/colors";
import ogImage from "../assets/5d3467711e1eb567830909e9073367edfa138777.png";

export function TermsOfServicePage() {
  const { t } = useT();
  const { language } = useLanguage();

  // SEO optimization
  useSEO({
    title: t("seoTermsTitle"),
    description: t("seoTermsDescription"),
    keywords: t("seoTermsKeywords"),
    ogImage: ogImage,
    ogType: "website",
    canonical: "https://blcityguide.com/terms",
    structuredData: {
      "@context": "https://schema.org",
      "@graph": [
        getBreadcrumbSchema([
          { name: "Home", url: "https://blcityguide.com/" },
          {
            name:
              language === "sr"
                ? "Uslovi korišćenja"
                : "Terms of Service",
            url: "https://blcityguide.com/terms",
          },
        ]),
      ],
    },
  });

  return (
    <div
      className="min-h-screen"
      style={{ background: BACKGROUNDS.white }}
    >
      <Header />

      {/* CONTENT SECTION */}
      <section className="py-16">
        <div className="max-w-[800px] mx-auto px-4">
          {/* Title */}
          <h1
            className="text-center mb-8"
            style={{
              fontSize: "42px",
              fontWeight: 700,
              background:
                "linear-gradient(135deg, #60A5FA 0%, #0E3DC5 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            {language === "sr"
              ? "Uslovi korišćenja"
              : "Terms of Service"}
          </h1>

          {/* Last Updated */}
          <p
            className="text-center mb-8"
            style={{
              fontSize: "14px",
              color: TEXT.secondary,
              fontStyle: "italic",
            }}
          >
            {language === "sr"
              ? "Posljednje ažuriranje: 6. februar 2026."
              : "Last updated: February 6, 2026"}
          </p>

          {/* Intro */}
          <div
            className="mb-8 p-6 rounded-lg"
            style={{
              background: BACKGROUNDS.lightGray,
              border: `1px solid ${BORDERS.light}`,
            }}
          >
            <p
              style={{
                fontSize: "16px",
                lineHeight: "1.7",
                color: TEXT.primary,
              }}
            >
              {language === "sr"
                ? 'Korišćenjem web-sajta Banja Luka Guide (u daljem tekstu: "Sajt") potvrđujete da ste upoznati sa ovim Uslovima korišćenja i da ih u potpunosti prihvatate. Ukoliko se ne slažete sa Uslovima, molimo vas da ne koristite Sajt.'
                : 'By using the Banja Luka Guide website (hereinafter: "Site"), you confirm that you are familiar with these Terms of Service and accept them in full. If you do not agree with the Terms, please do not use the Site.'}
            </p>
            <p
              className="mt-4"
              style={{
                fontSize: "16px",
                lineHeight: "1.7",
                color: TEXT.primary,
              }}
            >
              {language === "sr"
                ? "Zadržavamo pravo izmjene ovih Uslova u bilo kojem trenutku, bez prethodne najave. Izmjene stupaju na snagu objavljivanjem na ovoj stranici."
                : "We reserve the right to change these Terms at any time without prior notice. Changes take effect upon publication on this page."}
            </p>
          </div>

          {/* Section 1 */}
          <div className="mb-8">
            <h2
              className="mb-4"
              style={{
                fontSize: "24px",
                fontWeight: 600,
                color: BRAND.primary,
              }}
            >
              {language === "sr"
                ? "1. O sajtu"
                : "1. About the Site"}
            </h2>
            <p
              className="mb-3"
              style={{
                fontSize: "16px",
                lineHeight: "1.7",
                color: TEXT.primary,
              }}
            >
              {language === "sr"
                ? "Banja Luka Guide je informativni i vodički web-sajt koji korisnicima pruža pregled događaja, koncerata, kulturnih manifestacija, restorana i drugih dešavanja."
                : "Banja Luka Guide is an informative and guide website that provides users with an overview of events, concerts, cultural events, restaurants, and other happenings."}
            </p>
            <p
              style={{
                fontSize: "16px",
                lineHeight: "1.7",
                color: TEXT.primary,
              }}
            >
              {language === "sr"
                ? "Sajt ne organizuje događaje, već objedinjuje informacije dostupne iz različitih izvora."
                : "The Site does not organize events but consolidates information available from various sources."}
            </p>
          </div>

          {/* Section 2 */}
          <div className="mb-8">
            <h2
              className="mb-4"
              style={{
                fontSize: "24px",
                fontWeight: 600,
                color: BRAND.primary,
              }}
            >
              {language === "sr"
                ? "2. Autorska prava"
                : "2. Copyright"}
            </h2>
            <p
              className="mb-3"
              style={{
                fontSize: "16px",
                lineHeight: "1.7",
                color: TEXT.primary,
              }}
            >
              {language === "sr"
                ? "Sav sadržaj objavljen na Sajtu (tekstovi, fotografije, grafike, logo, dizajn) zaštićen je autorskim pravima."
                : "All content published on the Site (texts, photos, graphics, logo, design) is protected by copyright."}
            </p>
            <p
              style={{
                fontSize: "16px",
                lineHeight: "1.7",
                color: TEXT.primary,
              }}
            >
              {language === "sr"
                ? "Zabranjeno je kopiranje, distribucija ili korišćenje sadržaja u komercijalne svrhe bez prethodnog pisanog odobrenja vlasnika Sajta, osim u slučajevima dozvoljenim važećim zakonima."
                : "Copying, distribution, or commercial use of content without prior written permission from the Site owner is prohibited, except in cases permitted by applicable law."}
            </p>
          </div>

          {/* Section 3 */}
          <div className="mb-8">
            <h2
              className="mb-4"
              style={{
                fontSize: "24px",
                fontWeight: 600,
                color: BRAND.primary,
              }}
            >
              {language === "sr"
                ? "3. Linkovi ka drugim sajtovima"
                : "3. Links to Other Websites"}
            </h2>
            <p
              className="mb-3"
              style={{
                fontSize: "16px",
                lineHeight: "1.7",
                color: TEXT.primary,
              }}
            >
              {language === "sr"
                ? "Sajt može sadržavati linkove ka eksternim web-stranicama (npr. prodaja karata, rezervacije, društvene mreže)."
                : "The Site may contain links to external websites (e.g., ticket sales, reservations, social networks)."}
            </p>
            <p
              className="mb-3"
              style={{
                fontSize: "16px",
                lineHeight: "1.7",
                color: TEXT.primary,
              }}
            >
              {language === "sr"
                ? "Banja Luka Guide ne kontroliše sadržaj tih sajtova i ne snosi odgovornost za:"
                : "Banja Luka Guide does not control the content of those sites and is not responsible for:"}
            </p>
            <ul
              className="ml-6 mb-3"
              style={{
                fontSize: "16px",
                lineHeight: "1.7",
                color: TEXT.primary,
                listStyleType: "disc",
              }}
            >
              <li>
                {language === "sr"
                  ? "Tačnost informacija"
                  : "Accuracy of information"}
              </li>
              <li>
                {language === "sr"
                  ? "Dostupnost usluga"
                  : "Availability of services"}
              </li>
              <li>
                {language === "sr"
                  ? "Eventualnu štetu nastalu korišćenjem tih sajtova"
                  : "Any damage resulting from the use of those sites"}
              </li>
            </ul>
            <p
              style={{
                fontSize: "16px",
                lineHeight: "1.7",
                color: TEXT.primary,
              }}
            >
              {language === "sr"
                ? "Korisnik koristi eksterne linkove na sopstvenu odgovornost."
                : "Users use external links at their own risk."}
            </p>
          </div>

          {/* Section 4 */}
          <div className="mb-8">
            <h2
              className="mb-4"
              style={{
                fontSize: "24px",
                fontWeight: 600,
                color: BRAND.primary,
              }}
            >
              {language === "sr"
                ? "4. Tačnost informacija"
                : "4. Accuracy of Information"}
            </h2>
            <p
              className="mb-3"
              style={{
                fontSize: "16px",
                lineHeight: "1.7",
                color: TEXT.primary,
              }}
            >
              {language === "sr"
                ? "Iako nastojimo da informacije na Sajtu budu tačne i ažurne, Banja Luka Guide ne garantuje potpunu tačnost, potpunost ili pravovremenost svih objavljenih podataka."
                : "While we strive to ensure that the information on the Site is accurate and up-to-date, Banja Luka Guide does not guarantee complete accuracy, completeness, or timeliness of all published data."}
            </p>
            <p
              style={{
                fontSize: "16px",
                lineHeight: "1.7",
                color: TEXT.primary,
              }}
            >
              {language === "sr"
                ? "Zadržavamo pravo izmjene ili ispravke informacija u bilo kojem trenutku, bez obaveze prethodnog obavještavanja korisnika."
                : "We reserve the right to change or correct information at any time without the obligation to notify users in advance."}
            </p>
          </div>

          {/* Section 5 */}
          <div className="mb-8">
            <h2
              className="mb-4"
              style={{
                fontSize: "24px",
                fontWeight: 600,
                color: BRAND.primary,
              }}
            >
              {language === "sr"
                ? "5. Partneri i treće strane"
                : "5. Partners and Third Parties"}
            </h2>
            <p
              className="mb-3"
              style={{
                fontSize: "16px",
                lineHeight: "1.7",
                color: TEXT.primary,
              }}
            >
              {language === "sr"
                ? "Kupovina karata, rezervacije i druge usluge koje se nude putem linkova na Sajtu realizuju se direktno između korisnika i partnera."
                : "Ticket purchases, reservations, and other services offered through links on the Site are conducted directly between users and partners."}
            </p>
            <p
              className="mb-3"
              style={{
                fontSize: "16px",
                lineHeight: "1.7",
                color: TEXT.primary,
              }}
            >
              {language === "sr"
                ? "Banja Luka Guide nije ugovorna strana u tim odnosima i ne snosi odgovornost za:"
                : "Banja Luka Guide is not a contracting party in these relationships and is not responsible for:"}
            </p>
            <ul
              className="ml-6"
              style={{
                fontSize: "16px",
                lineHeight: "1.7",
                color: TEXT.primary,
                listStyleType: "disc",
              }}
            >
              <li>
                {language === "sr"
                  ? "Realizaciju usluga"
                  : "Service delivery"}
              </li>
              <li>
                {language === "sr"
                  ? "Otkazivanja"
                  : "Cancellations"}
              </li>
              <li>
                {language === "sr"
                  ? "Povrate novca"
                  : "Refunds"}
              </li>
              <li>
                {language === "sr"
                  ? "Eventualne sporove između korisnika i partnera"
                  : "Any disputes between users and partners"}
              </li>
            </ul>
          </div>

          {/* Section 6 */}
          <div className="mb-8">
            <h2
              className="mb-4"
              style={{
                fontSize: "24px",
                fontWeight: 600,
                color: BRAND.primary,
              }}
            >
              {language === "sr"
                ? "6. Zabranjeno ponašanje"
                : "6. Prohibited Behavior"}
            </h2>
            <p
              className="mb-3"
              style={{
                fontSize: "16px",
                lineHeight: "1.7",
                color: TEXT.primary,
              }}
            >
              {language === "sr"
                ? "Zabranjeno je:"
                : "It is prohibited to:"}
            </p>
            <ul
              className="ml-6 mb-3"
              style={{
                fontSize: "16px",
                lineHeight: "1.7",
                color: TEXT.primary,
                listStyleType: "disc",
              }}
            >
              <li>
                {language === "sr"
                  ? "Zloupotrebljavati sadržaj Sajta"
                  : "Misuse the content of the Site"}
              </li>
              <li>
                {language === "sr"
                  ? "Pokušavati neovlašten pristup sistemima"
                  : "Attempt unauthorized access to systems"}
              </li>
              <li>
                {language === "sr"
                  ? "Koristiti Sajt u nezakonite ili štetne svrhe"
                  : "Use the Site for illegal or harmful purposes"}
              </li>
            </ul>
            <p
              style={{
                fontSize: "16px",
                lineHeight: "1.7",
                color: TEXT.primary,
              }}
            >
              {language === "sr"
                ? "Zadržavamo pravo da ograničimo ili onemogućimo pristup Sajtu korisnicima koji krše ove Uslove."
                : "We reserve the right to restrict or disable access to the Site for users who violate these Terms."}
            </p>
          </div>

          {/* Section 7 */}
          <div className="mb-8">
            <h2
              className="mb-4"
              style={{
                fontSize: "24px",
                fontWeight: 600,
                color: BRAND.primary,
              }}
            >
              {language === "sr"
                ? "7. Ograničenje odgovornosti"
                : "7. Limitation of Liability"}
            </h2>
            <p
              className="mb-3"
              style={{
                fontSize: "16px",
                lineHeight: "1.7",
                color: TEXT.primary,
              }}
            >
              {language === "sr"
                ? "Banja Luka Guide ne snosi odgovornost za:"
                : "Banja Luka Guide is not responsible for:"}
            </p>
            <ul
              className="ml-6 mb-3"
              style={{
                fontSize: "16px",
                lineHeight: "1.7",
                color: TEXT.primary,
                listStyleType: "disc",
              }}
            >
              <li>
                {language === "sr"
                  ? "Direktnu ili indirektnu štetu"
                  : "Direct or indirect damage"}
              </li>
              <li>
                {language === "sr"
                  ? "Gubitak podataka"
                  : "Data loss"}
              </li>
              <li>
                {language === "sr"
                  ? "Prekide u radu Sajta"
                  : "Interruptions in Site operation"}
              </li>
              <li>
                {language === "sr"
                  ? "Odluke koje korisnici donesu na osnovu informacija sa Sajta"
                  : "Decisions users make based on information from the Site"}
              </li>
            </ul>
            <p
              style={{
                fontSize: "16px",
                lineHeight: "1.7",
                color: TEXT.primary,
              }}
            >
              {language === "sr"
                ? "Korišćenje Sajta je na sopstvenu odgovornost korisnika."
                : "Use of the Site is at the user's own risk."}
            </p>
          </div>

          {/* Section 8 */}
          <div className="mb-8">
            <h2
              className="mb-4"
              style={{
                fontSize: "24px",
                fontWeight: 600,
                color: BRAND.primary,
              }}
            >
              {language === "sr"
                ? "8. Pravno važenje"
                : "8. Legal Validity"}
            </h2>
            <p
              className="mb-3"
              style={{
                fontSize: "16px",
                lineHeight: "1.7",
                color: TEXT.primary,
              }}
            >
              {language === "sr"
                ? "Na ove Uslove korišćenja primjenjuje se važeće pravo prema sjedištu vlasnika Sajta."
                : "These Terms of Service are governed by the applicable law according to the seat of the Site owner."}
            </p>
            <p
              style={{
                fontSize: "16px",
                lineHeight: "1.7",
                color: TEXT.primary,
              }}
            >
              {language === "sr"
                ? "Svi sporovi rješavaju se pred nadležnim sudom."
                : "All disputes are resolved before the competent court."}
            </p>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}