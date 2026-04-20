export type PluralLocale = "sr" | "en";

export type PluralWordForms = {
  sr: { one: string; few: string; many: string };
  en: { one: string; many: string };
};

export function pluralizeSr(
  count: number,
  one: string,
  few: string,
  many: string,
): string {
  if (count % 10 === 1 && count % 100 !== 11) return one;
  if (
    count % 10 >= 2 &&
    count % 10 <= 4 &&
    (count % 100 < 12 || count % 100 > 14)
  )
    return few;
  return many;
}

export function pluralizeEn(
  count: number,
  singular: string,
  plural: string,
): string {
  return count === 1 ? singular : plural;
}

export function pluralize(
  count: number,
  locale: PluralLocale,
  forms: PluralWordForms,
): string {
  if (locale === "sr") {
    return pluralizeSr(count, forms.sr.one, forms.sr.few, forms.sr.many);
  }
  return pluralizeEn(count, forms.en.one, forms.en.many);
}
