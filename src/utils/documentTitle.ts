/** App-wide browser tab title (document.title) helpers — single source of formatting rules. */

export const DOCUMENT_TITLE_BRAND = "Zipa City Guide";

/** Listing section names (fixed labels per product spec). */
export const DOC_TITLE_EVENTS = "Dešavanja";
export const DOC_TITLE_THEATRE = "Pozorište";
export const DOC_TITLE_CINEMA = "Bioskop";
export const DOC_TITLE_CONCERTS = "Koncerti";
export const DOC_TITLE_CLUBS = "Klubovi";
export const DOC_TITLE_FOOD = "Hrana i piće";

function normalizedCity(city: string | null | undefined): string | undefined {
  const c = city?.trim();
  return c || undefined;
}

/** Home: "Zipa City Guide | {City}" or brand only if no city. */
export function homeDocumentTitle(city?: string | null): string {
  const c = normalizedCity(city);
  if (!c) return DOCUMENT_TITLE_BRAND;
  return `${DOCUMENT_TITLE_BRAND} | ${c}`;
}

/** Listings: "{Page} | {City} | Zipa City Guide" or "{Page} | Zipa City Guide" without city. */
export function listingDocumentTitle(pageName: string, city?: string | null): string {
  const c = normalizedCity(city);
  if (!c) return `${pageName} | ${DOCUMENT_TITLE_BRAND}`;
  return `${pageName} | ${c} | ${DOCUMENT_TITLE_BRAND}`;
}

/**
 * Event/venue detail: "{Title} | {City} | Zipa City Guide", or "{Title} | Zipa City Guide" without city.
 * Caller should pass a non-empty trimmed display title.
 */
export function detailDocumentTitle(entityTitle: string, city?: string | null): string {
  const title = entityTitle.trim() || DOCUMENT_TITLE_BRAND;
  const c = normalizedCity(city);
  if (!c) return `${title} | ${DOCUMENT_TITLE_BRAND}`;
  return `${title} | ${c} | ${DOCUMENT_TITLE_BRAND}`;
}

/** Detail routes while loading / before entity data: "Zipa City Guide". */
export function detailLoadingDocumentTitle(): string {
  return DOCUMENT_TITLE_BRAND;
}

export function adminDocumentTitle(): string {
  return `Admin | ${DOCUMENT_TITLE_BRAND}`;
}
