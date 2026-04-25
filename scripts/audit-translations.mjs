/**
 * Translation key audit: extract top-level keys from translations.ts
 * and search src for t("key") / tr("key") / keyof patterns.
 * Run: node scripts/audit-translations.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const transPath = path.join(root, "src/utils/translations.ts");

const transFull = fs.readFileSync(transPath, "utf8");
const transLines = transFull.split(/\r?\n/);

const keys = [];
const keyLineRe = /^  ([a-zA-Z0-9_]+):/;
for (const line of transLines) {
  const m = line.match(keyLineRe);
  if (m) keys.push(m[1]);
}
const unique = [...new Set(keys)];
if (keys.length !== unique.length) {
  console.error("Note: duplicate key lines found:", keys.length - unique.length);
}

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === "node_modules" || e.name === "build" || e.name === "dist")
      continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(tsx?|jsx?|mdx)$/.test(e.name)) out.push(p);
  }
  return out;
}

const srcFiles = walk(path.join(root, "src"));
const byFile = new Map();
for (const f of srcFiles) {
  byFile.set(
    f,
    fs.readFileSync(f, "utf8").replace(/\r\n/g, "\n"),
  );
}

const transOnly = byFile.get(transPath) || transFull;
const allExceptTrans = srcFiles
  .filter((f) => f !== transPath)
  .map((f) => byFile.get(f))
  .join("\n");
const allSrc = srcFiles.map((f) => byFile.get(f)).join("\n");

const patternsForKey = (k) => [
  `t("${k}"`,
  `t('${k}'`,
  "t(`" + k + "`", // t(`key`
  `tr("${k}"`,
  `tr('${k}'`,
  `"${k}" as keyof typeof translations`,
  `'${k}' as keyof typeof translations`,
  "`" + k + "` as keyof typeof translations",
  `t(\`category\``, // not per-key, skip
];

function hasDirectUsage(k, blob) {
  if (
    blob.includes(`t("${k}"`) ||
    blob.includes(`t('${k}'`) ||
    blob.includes("t(`" + k + "`")
  ) {
    return { kind: "t/ tr" };
  }
  if (blob.includes(`tr("${k}"`) || blob.includes(`tr('${k}'`)) {
    return { kind: "tr" };
  }
  if (
    blob.includes(`"${k}" as keyof typeof translations`) ||
    blob.includes(`'${k}' as keyof typeof translations`) ||
    blob.includes("`" + k + "` as keyof typeof translations")
  ) {
    return { kind: "as keyof" };
  }
  return null;
}

/** Also match object literal keys in TS: someComponent: { titleKey: "foo" } */
function hasStringLiteralUsage(k, blob) {
  const pats = [
    `"${k}"`,
    `'${k}'`,
    "`" + k + "`",
  ];
  for (const p of pats) {
    if (!blob.includes(p)) continue;
    if (k.length < 4) continue; // too many false positives for "on", "en", etc.
    // loose: if appears as standalone quoted string, flag uncertain elsewhere
  }
  return false;
}

const defUsed = [];
const probUnused = [];
const uncertain = [];

const dynamicPrefixes = [
  "category",
  "day",
  "venueTag",
  "cuisine_",
  "neighborhood_",
  "neighbourhood_",
  "mapPin",
];

function maybeDynamicKey(k) {
  if (dynamicPrefixes.some((p) => k.startsWith(p) || k.includes(p)))
    return "prefix/category-style";
  if (/^seo[A-Z]|^Seo|seo[A-Z]/.test(k) || k.endsWith("SeoTitle") || k.endsWith("SeoDescription"))
    return "seo* naming";
  if (k.includes("Event") && /[0-9]/.test(k) && (k.includes("nearby") || k.startsWith("nearby")))
    return "numbered placeholder keys";
  return null;
}

for (const k of unique) {
  const inOther = hasDirectUsage(k, allExceptTrans);
  if (inOther) {
    defUsed.push({ key: k, where: inOther.kind, scope: "outside translations.ts" });
    continue;
  }
  const inAll = hasDirectUsage(k, allSrc);
  if (inAll) {
    defUsed.push({ key: k, where: inAll.kind, scope: "any src (likely translations.ts or rare)" });
    continue;
  }

  const loose =
    (allExceptTrans.split(`"${k}"`).length - 1) +
    (allExceptTrans.split(`'${k}'`).length - 1) +
    (k.length > 2 ? (allExceptTrans.split("`" + k + "`").length - 1) : 0);
  if (loose > 0) {
    uncertain.push({
      key: k,
      reason: "same identifier appears quoted in code without t( — possible config/copy or false positive",
      approxQuotedOccurrences: loose,
    });
    continue;
  }

  const d = maybeDynamicKey(k);
  if (d) {
    uncertain.push({ key: k, reason: d });
    continue;
  }

  probUnused.push(k);
}

// Re-check: category* keys with as keyof in codebase
const categoryKeys = unique.filter((k) => k.startsWith("category"));
const asKeyofInSrc = allExceptTrans.includes("as keyof typeof translations");
for (const k of categoryKeys) {
  if (defUsed.find((d) => d.key === k)) continue;
  if (probUnused.includes(k)) {
    if (
      allExceptTrans.includes("category") &&
      (allExceptTrans.includes("`category") ||
        allExceptTrans.includes("category`") ||
        allExceptTrans.includes("category${") ||
        allExceptTrans.includes('+"category"'))
    ) {
      const idx = probUnused.indexOf(k);
      if (idx !== -1) probUnused.splice(idx, 1);
      if (!uncertain.find((u) => u.key === k))
        uncertain.push({
          key: k,
          reason:
            "category* likely used via t(`category${X}` as keyof) — verify manually",
        });
    }
  }
}

const report = {
  generated: new Date().toISOString(),
  summary: {
    totalTopLevelKeys: unique.length,
    definitelyUsed: defUsed.length,
    probablyUnused: probUnused.length,
    uncertain: uncertain.length,
  },
  definitelyUsed: defUsed.sort((a, b) => a.key.localeCompare(b.key)),
  probablyUnused: probUnused.sort(),
  uncertain: uncertain.sort((a, b) => String(a.key).localeCompare(String(b.key))),
  limitations: [
    "Keys are lines matching /^  keyName:/ (2-space indent) excluding false lat/en (4-space).",
    "definitelyUsed: t(\", t(', tr(\", or \"key\" as keyof typeof translations in any file except the match must be a real call pattern.",
    "String literals that pass the same text as a translation key in JSON/config were not deep-linked; uncertain.looseQuotes flags substring matches.",
    "Dynamic: category*, day*, venueTag*, etc. marked uncertain if not a direct t(\"key\").",
  ],
};

fs.writeFileSync(
  path.join(root, "scripts/translation-audit-report.json"),
  JSON.stringify(report, null, 2),
  "utf8",
);

console.log(JSON.stringify(report.summary, null, 2));
console.log("Wrote scripts/translation-audit-report.json");
console.log("Sample probablyUnused (first 40):", probUnused.slice(0, 40));
