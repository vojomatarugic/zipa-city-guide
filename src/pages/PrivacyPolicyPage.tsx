import { useT } from '../hooks/useT';
import { useLanguage } from '../contexts/LanguageContext';
import { useSEO } from '../hooks/useSEO';
import { useLocation as useSelectedCity } from '../contexts/LocationContext';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { listingDocumentTitle } from '../utils/documentTitle';
import { getBreadcrumbSchema } from '../utils/structuredData';
import { SITE_URL } from '../config/siteConfig';
import {
  LegalList,
  LegalListSpacious,
  LegalInlineLink,
  LegalPageLayout,
  LegalParagraph,
  LegalParagraphSpaced,
  LegalParagraphWideGap,
  LegalSection,
  LegalSectionTitle,
  LegalSubsectionTitle,
} from "../components/LegalPageLayout";
const ogImage = "/zipa-city-guide-OG.png";

const UI_CONTACT_EMAIL = "info@zipaagency.com";

export function PrivacyPolicyPage() {
  const { t } = useT();
  const { language } = useLanguage();
  const { selectedCity } = useSelectedCity();

  // SEO Setup
  const title = language === "sr" ? "Politika privatnosti" : "Privacy Policy";
  const description = language === "sr" 
    ? `Informacije o tome kako ${t("appName")} prikuplja, koristi i štiti vaše lične podatke u skladu sa GDPR propisima.`
    : `Information about how ${t("appName")} collects, uses, and protects your personal data in compliance with GDPR regulations.`;

  useDocumentTitle(listingDocumentTitle(title, selectedCity));

  useSEO({
    title,
    description,
    ogImage: ogImage,
    canonical: SITE_URL + "/privacyPolicy",
  });

  // Breadcrumb Structured Data
  const breadcrumbSchema = getBreadcrumbSchema([
    { name: language === "sr" ? "Početna" : "Home", url: SITE_URL + "/" },
    { name: title, url: SITE_URL + "/privacyPolicy" }
  ]);

  return (
    <LegalPageLayout
      title={language === "sr" ? "Politika privatnosti" : "Privacy Policy"}
      lastUpdatedLabel={language === "sr" ? "Posljednje ažuriranje:" : "Last updated:"}
      lastUpdatedValue={language === "sr" ? "6. februar 2026." : "February 6, 2026"}
      intro={
        <LegalParagraph>
          {language === "sr"
            ? `${t("appName")} poštuje privatnost svojih korisnika i obrađuje lične podatke u skladu sa važećim propisima o zaštiti podataka, uključujući Opštu uredbu o zaštiti podataka (GDPR).`
            : `${t("appName")} respects the privacy of its users and processes personal data in accordance with applicable data protection regulations, including the General Data Protection Regulation (GDPR).`}
        </LegalParagraph>
      }
    >
      {/* Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />

          {/* Section 1 */}
      <LegalSection>
        <LegalSectionTitle>
          {language === "sr" ? "1. Ko smo mi" : "1. Who We Are"}
        </LegalSectionTitle>
        <LegalParagraphSpaced>
              {language === "sr"
                ? `${t("appName")} je informativni i vodički web-sajt koji pruža pregled događaja, koncerata, kulturnih dešavanja i drugih sadržaja.`
                : `${t("appName")} is an informational and guide website that provides an overview of events, concerts, cultural happenings, and other content.`}
        </LegalParagraphSpaced>
        <LegalParagraph>
              <strong>{language === "sr" ? "Kontakt:" : "Contact:"}</strong>
              <br />
              E-mail:{" "}
              <LegalInlineLink href={`mailto:${UI_CONTACT_EMAIL}`}>
                {UI_CONTACT_EMAIL}
              </LegalInlineLink>
        </LegalParagraph>
      </LegalSection>

          {/* Section 2 */}
      <LegalSection>
        <LegalSectionTitle>
          {language === "sr" ? "2. Koje podatke prikupljamo" : "2. What Data We Collect"}
        </LegalSectionTitle>

        <LegalSubsectionTitle>
              {language === "sr" ? "a) Podaci o korisničkom nalogu (login / registracija)" : "a) User Account Data (login / registration)"}
        </LegalSubsectionTitle>
        <LegalParagraphSpaced>
              {language === "sr"
                ? "Prilikom kreiranja korisničkog naloga prikupljamo:"
                : "When creating a user account, we collect:"}
        </LegalParagraphSpaced>
        <LegalListSpacious>
              <li>{language === "sr" ? "e-mail adresu" : "email address"}</li>
              <li>{language === "sr" ? "osnovne tehničke podatke o prijavi (datum, vrijeme, IP adresa)" : "basic technical login data (date, time, IP address)"}</li>
        </LegalListSpacious>
        <LegalParagraphWideGap>
              {language === "sr"
                ? "Autentifikacija i upravljanje nalozima vrši se putem Supabase platforme."
                : "Authentication and account management is performed through the Supabase platform."}
        </LegalParagraphWideGap>

        <LegalSubsectionTitle>
              {language === "sr" ? "b) Kontakt forma" : "b) Contact Form"}
        </LegalSubsectionTitle>
        <LegalParagraphSpaced>
              {language === "sr"
                ? "Ako nas kontaktirate putem forme na Sajtu, možemo prikupljati:"
                : "If you contact us through the form on the Site, we may collect:"}
        </LegalParagraphSpaced>
        <LegalListSpacious>
              <li>{language === "sr" ? "ime (ako je uneseno)" : "name (if provided)"}</li>
              <li>{language === "sr" ? "e-mail adresu" : "email address"}</li>
              <li>{language === "sr" ? "sadržaj poruke" : "message content"}</li>
        </LegalListSpacious>
        <LegalParagraphWideGap>
              {language === "sr"
                ? "Ovi podaci koriste se isključivo za odgovor na vaš upit."
                : "This data is used exclusively to respond to your inquiry."}
        </LegalParagraphWideGap>

        <LegalSubsectionTitle>
              {language === "sr" ? "c) Tehnički i analitički podaci" : "c) Technical and Analytics Data"}
        </LegalSubsectionTitle>
        <LegalParagraphSpaced>
              {language === "sr"
                ? "Sajt prikuplja anonimne podatke o korišćenju putem analitičkih alata kao što su:"
                : "The Site collects anonymous usage data through analytics tools such as:"}
        </LegalParagraphSpaced>
        <LegalListSpacious>
              <li>Google Analytics</li>
              <li>Plausible Analytics</li>
        </LegalListSpacious>
        <LegalParagraphSpaced>
              {language === "sr"
                ? "Ovi alati prikupljaju podatke kao što su:"
                : "These tools collect data such as:"}
        </LegalParagraphSpaced>
        <LegalListSpacious>
              <li>{language === "sr" ? "tip uređaja i browser" : "device type and browser"}</li>
              <li>{language === "sr" ? "posjećene stranice" : "visited pages"}</li>
              <li>{language === "sr" ? "približna lokacija (grad/država)" : "approximate location (city/country)"}</li>
              <li>{language === "sr" ? "vrijeme zadržavanja na Sajtu" : "time spent on the Site"}</li>
        </LegalListSpacious>
        <LegalParagraph>
              {language === "sr"
                ? "Ovi podaci se koriste isključivo u svrhu analize i unapređenja Sajta."
                : "This data is used exclusively for the purpose of analyzing and improving the Site."}
        </LegalParagraph>
      </LegalSection>

          {/* Section 3 */}
      <LegalSection>
        <LegalSectionTitle>
              {language === "sr" ? "3. Kolačići (Cookies)" : "3. Cookies"}
        </LegalSectionTitle>
        <LegalParagraphSpaced>
              {language === "sr"
                ? `${t("appName")} koristi kolačiće:`
                : `${t("appName")} uses cookies:`}
        </LegalParagraphSpaced>
        <LegalListSpacious>
              <li>{language === "sr" ? "neophodne za funkcionisanje Sajta" : "necessary for the functioning of the Site"}</li>
              <li>{language === "sr" ? "analitičke (u vezi sa navedenim analitičkim alatima)" : "analytics (related to the mentioned analytics tools)"}</li>
        </LegalListSpacious>
        <LegalParagraph>
              {language === "sr"
                ? "Korisnik može u svakom trenutku upravljati ili onemogućiti kolačiće putem postavki svog browsera."
                : "Users can manage or disable cookies at any time through their browser settings."}
        </LegalParagraph>
      </LegalSection>

          {/* Section 4 */}
      <LegalSection>
        <LegalSectionTitle>
              {language === "sr" ? "4. Gdje se podaci čuvaju" : "4. Where Data is Stored"}
        </LegalSectionTitle>
        <LegalParagraphSpaced>
              {language === "sr"
                ? "Podaci se obrađuju i čuvaju putem pouzdanih trećih strana, uključujući:"
                : "Data is processed and stored through trusted third parties, including:"}
        </LegalParagraphSpaced>
        <LegalListSpacious>
              <li>{language === "sr" ? "Supabase (autentifikacija i baza podataka)" : "Supabase (authentication and database)"}</li>
              <li>{language === "sr" ? "analitičke servise (Google, Plausible)" : "analytics services (Google, Plausible)"}</li>
        </LegalListSpacious>
        <LegalParagraph>
              {language === "sr"
                ? "Ove platforme primjenjuju odgovarajuće tehničke i organizacione mjere zaštite podataka."
                : "These platforms implement appropriate technical and organizational data protection measures."}
        </LegalParagraph>
      </LegalSection>

          {/* Section 5 */}
      <LegalSection>
        <LegalSectionTitle>
              {language === "sr" ? "5. Dijeljenje podataka" : "5. Data Sharing"}
        </LegalSectionTitle>
        <LegalParagraphSpaced>
              {t("appName")}:
        </LegalParagraphSpaced>
        <LegalListSpacious>
              <li>{language === "sr" ? "ne prodaje lične podatke" : "does not sell personal data"}</li>
              <li>{language === "sr" ? "ne dijeli podatke sa trećim stranama u marketinške svrhe" : "does not share data with third parties for marketing purposes"}</li>
        </LegalListSpacious>
        <LegalParagraph>
              {language === "sr"
                ? "Podaci se dijele isključivo kada je to neophodno za funkcionisanje Sajta ili u skladu sa zakonskim obavezama."
                : "Data is shared only when necessary for the functioning of the Site or in accordance with legal obligations."}
        </LegalParagraph>
      </LegalSection>

          {/* Section 6 */}
      <LegalSection>
        <LegalSectionTitle>
              {language === "sr" ? "6. Prava korisnika (GDPR)" : "6. User Rights (GDPR)"}
        </LegalSectionTitle>
        <LegalParagraphSpaced>
              {language === "sr"
                ? "Korisnici imaju pravo da:"
                : "Users have the right to:"}
        </LegalParagraphSpaced>
        <LegalListSpacious>
              <li>{language === "sr" ? "zatraže uvid u svoje lične podatke" : "request access to their personal data"}</li>
              <li>{language === "sr" ? "zatraže ispravku ili brisanje podataka" : "request correction or deletion of data"}</li>
              <li>{language === "sr" ? "ograniče ili ulože prigovor na obradu" : "restrict or object to processing"}</li>
              <li>{language === "sr" ? "zatraže prenos podataka" : "request data portability"}</li>
              <li>{language === "sr" ? "povuku saglasnost (gdje je primjenjivo)" : "withdraw consent (where applicable)"}</li>
        </LegalListSpacious>
        <LegalParagraph>
              {language === "sr"
                ? "Za ostvarivanje ovih prava, korisnici nas mogu kontaktirati putem e-maila."
                : "To exercise these rights, users can contact us via email."}
        </LegalParagraph>
      </LegalSection>

          {/* Section 7 */}
      <LegalSection>
        <LegalSectionTitle>
              {language === "sr" ? "7. Period čuvanja podataka" : "7. Data Retention Period"}
        </LegalSectionTitle>
        <LegalParagraph>
              {language === "sr"
                ? "Lični podaci se čuvaju onoliko dugo koliko je potrebno za svrhu za koju su prikupljeni, ili dok korisnik ne zatraži njihovo brisanje, osim ako zakon ne zahtijeva drugačije."
                : "Personal data is retained for as long as necessary for the purpose for which it was collected, or until the user requests its deletion, unless otherwise required by law."}
        </LegalParagraph>
      </LegalSection>

          {/* Section 8 */}
      <LegalSection>
        <LegalSectionTitle>
              {language === "sr" ? "8. Sigurnost podataka" : "8. Data Security"}
        </LegalSectionTitle>
        <LegalParagraph>
              {language === "sr"
                ? "Primjenjujemo razumne tehničke i organizacione mjere kako bismo zaštitili podatke od neovlaštenog pristupa, gubitka ili zloupotrebe."
                : "We implement reasonable technical and organizational measures to protect data from unauthorized access, loss, or misuse."}
        </LegalParagraph>
      </LegalSection>

          {/* Section 9 */}
      <LegalSection>
        <LegalSectionTitle>
              {language === "sr" ? "9. Izmjene politike privatnosti" : "9. Changes to Privacy Policy"}
        </LegalSectionTitle>
        <LegalParagraph>
              {language === "sr"
                ? "Zadržavamo pravo izmjene ove Politike privatnosti. Sve izmjene biće objavljene na ovoj stranici i stupaju na snagu objavljivanjem."
                : "We reserve the right to amend this Privacy Policy. All changes will be posted on this page and will take effect upon posting."}
        </LegalParagraph>
      </LegalSection>
    </LegalPageLayout>
  );
}