import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const report = JSON.parse(
  fs.readFileSync(path.join(__dirname, "translation-audit-report.json"), "utf8"),
);

const alreadyRemoved = new Set([
  "aboutClub",
  "aboutConcert",
  "aboutEvent",
  "aboutMagazine",
  "aboutMovie",
  "aboutRestaurant",
  "aboutShow",
  "aboutUs",
  "aboutVenue",
  "aboutZipa",
  "accessDenied",
  "accommodationByDistrict",
  "accommodationByType",
  "accommodationByTypeTitle",
  "accommodationIntroDesc",
  "accommodationMapLongText",
  "accommodationPageDesc",
  "accommodationPageTitle",
  "account",
  "addAnotherEventTerm",
]);

function filterKey(k) {
  if (k.startsWith("category")) return false;
  if (k.startsWith("venueType")) return false;
  if (k.startsWith("day")) return false;
  if (k.length <= 5) return false;
  if (/\d/.test(k)) return false;
  if (/^event(D|d)ate/i.test(k) || /^eventTime/i.test(k) || /^eventPrice/i.test(k))
    return false;
  if (/^event.*(Date|Time|Price)\d*$/i.test(k)) return false;
  return true;
}

const filtered = report.probablyUnused.filter(
  (k) => filterKey(k) && !alreadyRemoved.has(k),
);

const next20 = filtered.slice(0, 20);
console.log("Next 20 keys:", JSON.stringify(next20, null, 2));

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === "node_modules" || e.name === "build") continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(ts|tsx|json|mdx)$/.test(e.name)) out.push(p);
  }
  return out;
}

const transPath = path.join(root, "src/utils/translations.ts");
const otherFiles = walk(path.join(root, "src")).filter((f) => f !== transPath);
let outside = "";
for (const f of otherFiles) {
  outside += fs.readFileSync(f, "utf8") + "\n";
}

function hasUsageOutside(k) {
  const t1 = `t("${k}")`;
  const t2 = `t('${k}')`;
  const t3 = "t(`" + k + "`)";
  const tr1 = `tr("${k}")`;
  const tr2 = `tr('${k}')`;
  const ko1 = `"${k}" as keyof typeof translations`;
  const ko2 = `'${k}' as keyof typeof translations`;
  const ko3 = "`" + k + "` as keyof typeof translations";
  if (outside.includes(t1) || outside.includes(t2) || outside.includes(t3)) return { use: true, from: "t(...)" };
  if (outside.includes(tr1) || outside.includes(tr2)) return { use: true, from: "tr(...)" };
  if (outside.includes(ko1) || outside.includes(ko2) || outside.includes(ko3))
    return { use: true, from: "as keyof" };
  if (outside.includes(`"${k}"`)) return { use: true, from: 'raw "' + k + '"' };
  if (outside.includes(`'${k}'`)) return { use: true, from: "raw '" + k + "'" };
  if (k.length > 2 && outside.includes("`" + k + "`")) return { use: true, from: "raw `" + k + "`" };
  return { use: false };
}

const result = next20.map((k) => ({ k, ...hasUsageOutside(k) }));
console.log(JSON.stringify(result, null, 2));
