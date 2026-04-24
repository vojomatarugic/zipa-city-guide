import {
  cityEquals,
  citySearchMatchTier,
  getAvailableCities,
  getTopCities,
  normalizeCityForCompare,
  sortCitiesForSearchQuery,
} from "./city";

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

assert(
  cityEquals("Banja Luka", "banja luka"),
  "Expected Banja Luka to equal banja luka",
);
assert(
  cityEquals("BANJA   LUKA", "banja luka"),
  "Expected BANJA   LUKA to equal banja luka",
);
assert(
  cityEquals("  BANJA   LUKA  ", "banja luka"),
  "Expected spaced BANJA   LUKA to equal banja luka",
);
assert(
  cityEquals("Gradiška", "Gradiska"),
  "Expected Gradiška to equal Gradiska",
);
assert(
  cityEquals("Čelinac", "Celinac"),
  "Expected Čelinac to equal Celinac",
);
assert(
  !cityEquals("Istočno Sarajevo", "Sarajevo"),
  "Expected Istočno Sarajevo to differ from Sarajevo",
);
assert(
  !cityEquals("Novo Sarajevo", "Sarajevo"),
  "Expected Novo Sarajevo to differ from Sarajevo",
);
assert(
  normalizeCityForCompare(undefined) === "",
  "Expected undefined city to normalize to empty string",
);
assert(
  !cityEquals("Prijedor", "Banja Luka"),
  "Expected Prijedor to differ from Banja Luka",
);

const cityFixtures = [
  { city: " zagreb " },
  { city: "ZAGREB" },
  { city: "Zagreb" },
  { city: "banja luka" },
  { city: "Banja Luka" },
  { city: "Banja Luka" },
  { city: "  " },
  { city: null },
];

const available = getAvailableCities(cityFixtures);
assert(available.length === 2, "Expected deduplicated available city list");
assert(
  available.some((c) => c.label === "Banja Luka"),
  "Expected Banja Luka in available cities",
);
assert(
  available.some((c) => c.label === "Zagreb"),
  "Expected Zagreb in available cities",
);

const top = getTopCities(cityFixtures, 6);
assert(top.length === 2, "Expected deduplicated top city list");
assert(top[0].label === "Banja Luka", "Expected Banja Luka to be top city");
assert(top[0].count === 3, "Expected Banja Luka count to be merged");

const gradiškaVariants = [
  { city: "Gradiska" },
  { city: "Gradiška" },
  { city: " GRADIŠKA " },
];
const gradiskaAvailable = getAvailableCities(gradiškaVariants);
assert(
  gradiskaAvailable.length === 1,
  "Expected Gradiška variants to merge to one bucket",
);
assert(
  gradiskaAvailable[0]!.label === "Gradiška",
  "Expected display label Gradiška (diacritics + title case)",
);
assert(
  normalizeCityForCompare(gradiskaAvailable[0]!.label) ===
    gradiskaAvailable[0]!.key,
  "Expected option key to match normalized display label",
);

const čelinacVariants = [{ city: "Celinac" }, { city: "Čelinac" }];
const čelinacAvailable = getAvailableCities(čelinacVariants);
assert(
  čelinacAvailable.length === 1,
  "Expected Čelinac/Celinac to merge to one bucket",
);
assert(
  čelinacAvailable[0]!.label === "Čelinac",
  "Expected display label Čelinac when a diacritic variant exists",
);

const searchQuery = "gradiska";
const normalizedQuery = normalizeCityForCompare(searchQuery);
assert(
  gradiskaAvailable.some((c) =>
    normalizeCityForCompare(c.label).includes(normalizedQuery),
  ),
  "Expected search against normalized display label to match Gradiska query",
);

const šamacSamac = getAvailableCities([{ city: "Samac" }, { city: "Šamac" }]);
assert(
  šamacSamac.length === 1 && šamacSamac[0]!.label === "Šamac",
  "Expected Šamac display when a diacritic variant exists",
);

const bihacBihać = getAvailableCities([{ city: "Bihac" }, { city: "Bihać" }]);
assert(
  bihacBihać.length === 1 && bihacBihać[0]!.label === "Bihać",
  "Expected Bihać display when a diacritic variant exists",
);

const modricaModriča = getAvailableCities([
  { city: "Modrica" },
  { city: "Modriča" },
]);
assert(
  modricaModriča.length === 1 && modricaModriča[0]!.label === "Modriča",
  "Expected Modriča display when a diacritic variant exists",
);

const nfdŠamac = "S\u030Camac";
assert(
  getAvailableCities([{ city: "Samac" }, { city: nfdŠamac }])[0]!.label ===
    "Šamac",
  "Expected NFC to detect Š in decomposed spelling for display preference",
);

const šRanked = sortCitiesForSearchQuery(
  [
    { key: normalizeCityForCompare("Sarajevo"), label: "Sarajevo" },
    { key: normalizeCityForCompare("Šamac"), label: "Šamac" },
  ],
  "š",
  new Map([
    [normalizeCityForCompare("Sarajevo"), 500],
    [normalizeCityForCompare("Šamac"), 1],
  ]),
);
assert(
  šRanked[0]!.label === "Šamac",
  "Expected literal š match to rank above higher-count normalized-only match",
);

assert(
  citySearchMatchTier("Gradiška", "gradiska") === 1,
  "Expected gradiska to match Gradiška on normalized tier only",
);
assert(
  citySearchMatchTier("Gradiška", "gradiš") === 0,
  "Expected gradiš to literal-match Gradiška",
);

function filterCitiesByNormalizedQuery<
  T extends { key: string; label: string },
>(cities: T[], rawQuery: string): T[] {
  const nq = normalizeCityForCompare(rawQuery);
  if (!nq) return cities;
  return cities.filter((c) =>
    normalizeCityForCompare(c.label).includes(nq),
  );
}

const bihaćBucket = getAvailableCities([{ city: "Bihac" }, { city: "Bihać" }]);
const bihaćFromAsciiQuery = sortCitiesForSearchQuery(
  filterCitiesByNormalizedQuery(bihaćBucket, "bihac"),
  "bihac",
);
assert(
  bihaćFromAsciiQuery.length === 1 &&
    bihaćFromAsciiQuery[0]!.label === "Bihać",
  "Expected ASCII query bihac to match and still display Bihać",
);

const modričaBucket = getAvailableCities([
  { city: "Modrica" },
  { city: "Modriča" },
]);
const modričaFromAsciiQuery = sortCitiesForSearchQuery(
  filterCitiesByNormalizedQuery(modričaBucket, "modrica"),
  "modrica",
);
assert(
  modričaFromAsciiQuery.length === 1 &&
    modričaFromAsciiQuery[0]!.label === "Modriča",
  "Expected ASCII query modrica to match and still display Modriča",
);

assert(
  getAvailableCities([{ city: "MODRIČA" }, { city: "Modriča" }])[0]!.label ===
    "Modriča",
  "Expected title-cased diacritic form over all-caps when both have č",
);
