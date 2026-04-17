import { useT } from '../hooks/useT';
import { useLanguage } from '../contexts/LanguageContext';
import { useSEO } from '../hooks/useSEO';
import { getBreadcrumbSchema } from '../utils/structuredData';
import { BRAND, TEXT, BACKGROUNDS, BORDERS } from '../utils/colors';
import ogImage from "../assets/5d3467711e1eb567830909e9073367edfa138777.png";

export function PrivacyPolicyPage() {
  const { t } = useT();
  const { language } = useLanguage();

  // SEO Setup
  const title = language === "sr" ? "Politika privatnosti" : "Privacy Policy";
  const description = language === "sr" 
    ? `Informacije o tome kako ${t("appName")} prikuplja, koristi i štiti vaše lične podatke u skladu sa GDPR propisima.`
    : `Information about how ${t("appName")} collects, uses, and protects your personal data in compliance with GDPR regulations.`;

  useSEO({
    title,
    description,
    ogImage: ogImage,
    canonical: `https://banjalukaguide.com/${language}/privacyPolicy`,
  });

  // Breadcrumb Structured Data
  const breadcrumbSchema = getBreadcrumbSchema([
    { name: language === "sr" ? "Početna" : "Home", url: "https://banjalukaguide.com" },
    { name: title, url: `https://banjalukaguide.com/${language}/privacyPolicy` }
  ]);

  return (
    <div className="min-h-screen flex flex-col">
      {/* Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />

      {/* CONTENT SECTION */}
      <section className="py-16">
        <div className="max-w-[800px] mx-auto px-4">
          {/* Title */}
          <h1
            className="text-center mb-8"
            style={{
              fontSize: "42px",
              fontWeight: 700,
              background: "linear-gradient(135deg, #60A5FA 0%, #0E3DC5 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            {language === "sr" ? "Politika privatnosti" : "Privacy Policy"}
          </h1>

          {/* Last Updated */}
          <p
            className="text-center mb-8"
            style={{
              fontSize: "14px",
              color: TEXT.secondary,
            }}
          >
            {language === "sr" ? "Posljednje ažuriranje: " : "Last updated: "}
            <strong>{language === "sr" ? "6. februar 2026." : "February 6, 2026"}</strong>
          </p>

          {/* Intro */}
          <p
            className="mb-8"
            style={{
              fontSize: "16px",
              lineHeight: "1.8",
              color: TEXT.primary,
              backgroundColor: BACKGROUNDS.lightGray,
              border: `1px solid ${BORDERS.light}`,
              borderRadius: "12px",
              padding: "24px",
              boxShadow: "0 1px 3px rgba(0, 0, 0, 0.05)",
            }}
          >
            {language === "sr"
              ? `${t("appName")} poštuje privatnost svojih korisnika i obrađuje lične podatke u skladu sa važećim propisima o zaštiti podataka, uključujući Opštu uredbu o zaštiti podataka (GDPR).`
              : `${t("appName")} respects the privacy of its users and processes personal data in accordance with applicable data protection regulations, including the General Data Protection Regulation (GDPR).`}
          </p>

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
              {language === "sr" ? "1. Ko smo mi" : "1. Who We Are"}
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
                ? `${t("appName")} je informativni i vodički web-sajt koji pruža pregled događaja, koncerata, kulturnih dešavanja i drugih sadržaja.`
                : `${t("appName")} is an informational and guide website that provides an overview of events, concerts, cultural happenings, and other content.`}
            </p>
            <p
              style={{
                fontSize: "16px",
                lineHeight: "1.7",
                color: TEXT.primary,
              }}
            >
              <strong>{language === "sr" ? "Kontakt:" : "Contact:"}</strong>
              <br />
              E-mail: <a href="mailto:info@banjalukaguide.com" style={{ color: BRAND.primary }}>info@banjalukaguide.com</a>
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
              {language === "sr" ? "2. Koje podatke prikupljamo" : "2. What Data We Collect"}
            </h2>

            <h3
              className="mb-3"
              style={{
                fontSize: "18px",
                fontWeight: 600,
                color: TEXT.primary,
              }}
            >
              {language === "sr" ? "a) Podaci o korisničkom nalogu (login / registracija)" : "a) User Account Data (login / registration)"}
            </h3>
            <p
              className="mb-3"
              style={{
                fontSize: "16px",
                lineHeight: "1.7",
                color: TEXT.primary,
              }}
            >
              {language === "sr"
                ? "Prilikom kreiranja korisničkog naloga prikupljamo:"
                : "When creating a user account, we collect:"}
            </p>
            <ul
              className="mb-4 ml-6"
              style={{
                fontSize: "16px",
                lineHeight: "1.7",
                color: TEXT.primary,
                listStyleType: "disc",
              }}
            >
              <li>{language === "sr" ? "e-mail adresu" : "email address"}</li>
              <li>{language === "sr" ? "osnovne tehničke podatke o prijavi (datum, vrijeme, IP adresa)" : "basic technical login data (date, time, IP address)"}</li>
            </ul>
            <p
              className="mb-4"
              style={{
                fontSize: "16px",
                lineHeight: "1.7",
                color: TEXT.primary,
              }}
            >
              {language === "sr"
                ? "Autentifikacija i upravljanje nalozima vrši se putem Supabase platforme."
                : "Authentication and account management is performed through the Supabase platform."}
            </p>

            <h3
              className="mb-3"
              style={{
                fontSize: "18px",
                fontWeight: 600,
                color: TEXT.primary,
              }}
            >
              {language === "sr" ? "b) Kontakt forma" : "b) Contact Form"}
            </h3>
            <p
              className="mb-3"
              style={{
                fontSize: "16px",
                lineHeight: "1.7",
                color: TEXT.primary,
              }}
            >
              {language === "sr"
                ? "Ako nas kontaktirate putem forme na Sajtu, možemo prikupljati:"
                : "If you contact us through the form on the Site, we may collect:"}
            </p>
            <ul
              className="mb-4"
              style={{
                fontSize: "16px",
                lineHeight: "1.7",
                color: TEXT.primary,
                listStyleType: "disc",
                marginLeft: "24px",
              }}
            >
              <li>{language === "sr" ? "ime (ako je uneseno)" : "name (if provided)"}</li>
              <li>{language === "sr" ? "e-mail adresu" : "email address"}</li>
              <li>{language === "sr" ? "sadržaj poruke" : "message content"}</li>
            </ul>
            <p
              className="mb-4"
              style={{
                fontSize: "16px",
                lineHeight: "1.7",
                color: TEXT.primary,
              }}
            >
              {language === "sr"
                ? "Ovi podaci koriste se isključivo za odgovor na vaš upit."
                : "This data is used exclusively to respond to your inquiry."}
            </p>

            <h3
              className="mb-3"
              style={{
                fontSize: "18px",
                fontWeight: 600,
                color: TEXT.primary,
              }}
            >
              {language === "sr" ? "c) Tehnički i analitički podaci" : "c) Technical and Analytics Data"}
            </h3>
            <p
              className="mb-3"
              style={{
                fontSize: "16px",
                lineHeight: "1.7",
                color: TEXT.primary,
              }}
            >
              {language === "sr"
                ? "Sajt prikuplja anonimne podatke o korišćenju putem analitičkih alata kao što su:"
                : "The Site collects anonymous usage data through analytics tools such as:"}
            </p>
            <ul
              className="mb-4"
              style={{
                fontSize: "16px",
                lineHeight: "1.7",
                color: TEXT.primary,
                listStyleType: "disc",
                marginLeft: "24px",
              }}
            >
              <li>Google Analytics</li>
              <li>Plausible Analytics</li>
            </ul>
            <p
              className="mb-3"
              style={{
                fontSize: "16px",
                lineHeight: "1.7",
                color: TEXT.primary,
              }}
            >
              {language === "sr"
                ? "Ovi alati prikupljaju podatke kao što su:"
                : "These tools collect data such as:"}
            </p>
            <ul
              className="mb-4"
              style={{
                fontSize: "16px",
                lineHeight: "1.7",
                color: TEXT.primary,
                listStyleType: "disc",
                marginLeft: "24px",
              }}
            >
              <li>{language === "sr" ? "tip uređaja i browser" : "device type and browser"}</li>
              <li>{language === "sr" ? "posjećene stranice" : "visited pages"}</li>
              <li>{language === "sr" ? "približna lokacija (grad/država)" : "approximate location (city/country)"}</li>
              <li>{language === "sr" ? "vrijeme zadržavanja na Sajtu" : "time spent on the Site"}</li>
            </ul>
            <p
              style={{
                fontSize: "16px",
                lineHeight: "1.7",
                color: TEXT.primary,
              }}
            >
              {language === "sr"
                ? "Ovi podaci se koriste isključivo u svrhu analize i unapređenja Sajta."
                : "This data is used exclusively for the purpose of analyzing and improving the Site."}
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
              {language === "sr" ? "3. Kolačići (Cookies)" : "3. Cookies"}
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
                ? `${t("appName")} koristi kolačiće:`
                : `${t("appName")} uses cookies:`}
            </p>
            <ul
              className="mb-4"
              style={{
                fontSize: "16px",
                lineHeight: "1.7",
                color: TEXT.primary,
                listStyleType: "disc",
                marginLeft: "24px",
              }}
            >
              <li>{language === "sr" ? "neophodne za funkcionisanje Sajta" : "necessary for the functioning of the Site"}</li>
              <li>{language === "sr" ? "analitičke (u vezi sa navedenim analitičkim alatima)" : "analytics (related to the mentioned analytics tools)"}</li>
            </ul>
            <p
              style={{
                fontSize: "16px",
                lineHeight: "1.7",
                color: TEXT.primary,
              }}
            >
              {language === "sr"
                ? "Korisnik može u svakom trenutku upravljati ili onemogućiti kolačiće putem postavki svog browsera."
                : "Users can manage or disable cookies at any time through their browser settings."}
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
              {language === "sr" ? "4. Gdje se podaci čuvaju" : "4. Where Data is Stored"}
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
                ? "Podaci se obrađuju i čuvaju putem pouzdanih trećih strana, uključujući:"
                : "Data is processed and stored through trusted third parties, including:"}
            </p>
            <ul
              className="mb-4"
              style={{
                fontSize: "16px",
                lineHeight: "1.7",
                color: TEXT.primary,
                listStyleType: "disc",
                marginLeft: "24px",
              }}
            >
              <li>{language === "sr" ? "Supabase (autentifikacija i baza podataka)" : "Supabase (authentication and database)"}</li>
              <li>{language === "sr" ? "analitičke servise (Google, Plausible)" : "analytics services (Google, Plausible)"}</li>
            </ul>
            <p
              style={{
                fontSize: "16px",
                lineHeight: "1.7",
                color: TEXT.primary,
              }}
            >
              {language === "sr"
                ? "Ove platforme primjenjuju odgovarajuće tehničke i organizacione mjere zaštite podataka."
                : "These platforms implement appropriate technical and organizational data protection measures."}
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
              {language === "sr" ? "5. Dijeljenje podataka" : "5. Data Sharing"}
            </h2>
            <p
              className="mb-3"
              style={{
                fontSize: "16px",
                lineHeight: "1.7",
                color: TEXT.primary,
              }}
            >
              {t("appName")}:
            </p>
            <ul
              className="mb-4"
              style={{
                fontSize: "16px",
                lineHeight: "1.7",
                color: TEXT.primary,
                listStyleType: "disc",
                marginLeft: "24px",
              }}
            >
              <li>{language === "sr" ? "ne prodaje lične podatke" : "does not sell personal data"}</li>
              <li>{language === "sr" ? "ne dijeli podatke sa trećim stranama u marketinške svrhe" : "does not share data with third parties for marketing purposes"}</li>
            </ul>
            <p
              style={{
                fontSize: "16px",
                lineHeight: "1.7",
                color: TEXT.primary,
              }}
            >
              {language === "sr"
                ? "Podaci se dijele isključivo kada je to neophodno za funkcionisanje Sajta ili u skladu sa zakonskim obavezama."
                : "Data is shared only when necessary for the functioning of the Site or in accordance with legal obligations."}
            </p>
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
              {language === "sr" ? "6. Prava korisnika (GDPR)" : "6. User Rights (GDPR)"}
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
                ? "Korisnici imaju pravo da:"
                : "Users have the right to:"}
            </p>
            <ul
              className="mb-4"
              style={{
                fontSize: "16px",
                lineHeight: "1.7",
                color: TEXT.primary,
                listStyleType: "disc",
                marginLeft: "24px",
              }}
            >
              <li>{language === "sr" ? "zatraže uvid u svoje lične podatke" : "request access to their personal data"}</li>
              <li>{language === "sr" ? "zatraže ispravku ili brisanje podataka" : "request correction or deletion of data"}</li>
              <li>{language === "sr" ? "ograniče ili ulože prigovor na obradu" : "restrict or object to processing"}</li>
              <li>{language === "sr" ? "zatraže prenos podataka" : "request data portability"}</li>
              <li>{language === "sr" ? "povuku saglasnost (gdje je primjenjivo)" : "withdraw consent (where applicable)"}</li>
            </ul>
            <p
              style={{
                fontSize: "16px",
                lineHeight: "1.7",
                color: TEXT.primary,
              }}
            >
              {language === "sr"
                ? "Za ostvarivanje ovih prava, korisnici nas mogu kontaktirati putem e-maila."
                : "To exercise these rights, users can contact us via email."}
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
              {language === "sr" ? "7. Period čuvanja podataka" : "7. Data Retention Period"}
            </h2>
            <p
              style={{
                fontSize: "16px",
                lineHeight: "1.7",
                color: TEXT.primary,
              }}
            >
              {language === "sr"
                ? "Lični podaci se čuvaju onoliko dugo koliko je potrebno za svrhu za koju su prikupljeni, ili dok korisnik ne zatraži njihovo brisanje, osim ako zakon ne zahtijeva drugačije."
                : "Personal data is retained for as long as necessary for the purpose for which it was collected, or until the user requests its deletion, unless otherwise required by law."}
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
              {language === "sr" ? "8. Sigurnost podataka" : "8. Data Security"}
            </h2>
            <p
              style={{
                fontSize: "16px",
                lineHeight: "1.7",
                color: TEXT.primary,
              }}
            >
              {language === "sr"
                ? "Primjenjujemo razumne tehničke i organizacione mjere kako bismo zaštitili podatke od neovlaštenog pristupa, gubitka ili zloupotrebe."
                : "We implement reasonable technical and organizational measures to protect data from unauthorized access, loss, or misuse."}
            </p>
          </div>

          {/* Section 9 */}
          <div className="mb-8">
            <h2
              className="mb-4"
              style={{
                fontSize: "24px",
                fontWeight: 600,
                color: BRAND.primary,
              }}
            >
              {language === "sr" ? "9. Izmjene politike privatnosti" : "9. Changes to Privacy Policy"}
            </h2>
            <p
              style={{
                fontSize: "16px",
                lineHeight: "1.7",
                color: TEXT.primary,
              }}
            >
              {language === "sr"
                ? "Zadržavamo pravo izmjene ove Politike privatnosti. Sve izmjene biće objavljene na ovoj stranici i stupaju na snagu objavljivanjem."
                : "We reserve the right to amend this Privacy Policy. All changes will be posted on this page and will take effect upon posting."}
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}