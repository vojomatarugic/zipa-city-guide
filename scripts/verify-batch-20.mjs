import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const r = JSON.parse(
  fs.readFileSync(path.join(__dirname, "translation-audit-report.json"), "utf8"),
);
const keys = r.probablyUnused
  .filter((k) => {
    if (k.startsWith("category") || k.startsWith("venueType") || k.startsWith("day"))
      return false;
    if (k.length <= 5) return false;
    if (/\d/.test(k)) return false;
    if (/^(event|nearby)(Date|Time|Price|Event)/i.test(k)) return false;
    return true;
  })
  .slice(0, 20);

function walk(d, a = []) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    if (e.name === "node_modules" || e.name === "build") continue;
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p, a);
    else if (/\.(ts|tsx|json|mdx)$/.test(e.name)) a.push(p);
  }
  return a;
}

const root = path.join(__dirname, "..");
const files = walk(path.join(root, "src"));
let blob = "";
for (const f of files) {
  blob += fs.readFileSync(f, "utf8") + "\n";
}

const out = [];
for (const k of keys) {
  const t1 = `t("${k}")`;
  const t2 = `t('${k}')`;
  const tr1 = `tr("${k}")`;
  const tr2 = `tr('${k}')`;
  const hasT = blob.includes(t1) || blob.includes(t2);
  const hasTr = blob.includes(tr1) || blob.includes(tr2);
  const hasKeyof =
    blob.includes(`"${k}" as keyof`) || blob.includes(`'${k}' as keyof`) || blob.includes(`\`${k}\` as keyof`);
  const hasQuotedD = blob.includes(`"${k}"`);
  const hasQuotedS = blob.includes(`'${k}'`);
  // "raw string" = quoted forms (includes translation values that embed the key in a sentence - rare for camelCase)
  const hasRawQuoted = hasQuotedD || hasQuotedS;
  const anyCall = hasT || hasTr || hasKeyof;
  // USED if explicit t/tr/keyof, OR quoted string appears (could be schema) — conservative: count quoted only if not only from t("x") overlap
  const usedByQuote =
    hasRawQuoted &&
    !(
      (blob.match(new RegExp(`t\\(["']${k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["']\\)`, "g")) || [])
        .length > 0
    );
  // Simpler: USED = t or tr or keyof, OR ("key" in file outside of being only the inner part of t("key"))
  const used = hasT || hasTr || hasKeyof;
  // secondary: if `translate(k` with variable skip. If "key" appears in non-trans file as data
  out.push({
    key: k,
    hasT,
    hasTr,
    hasKeyof,
    hasQuotedD,
    hasQuotedS,
    usedByExplicitCall: used,
  });
}
console.log(JSON.stringify({ keys, results: out }, null, 2));
