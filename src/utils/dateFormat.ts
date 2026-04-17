export type AppLocale = "sr" | "en";

type DateInput = Date | string | number | null | undefined;

function toValidDate(value: DateInput): Date | null {
  if (value == null) return null;
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function normalizeSrShortMonth(raw: string): string {
  return raw.replace(/\./g, "").trim().toLowerCase();
}

function splitDateParts(date: Date, locale: AppLocale): { day: string; month: string; year: string } {
  const formatter = new Intl.DateTimeFormat(locale === "sr" ? "sr-Latn" : "en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  const parts = formatter.formatToParts(date);
  const day = parts.find((part) => part.type === "day")?.value ?? "";
  const monthRaw = parts.find((part) => part.type === "month")?.value ?? "";
  const year = parts.find((part) => part.type === "year")?.value ?? "";

  return {
    day,
    month: locale === "sr" ? normalizeSrShortMonth(monthRaw) : monthRaw,
    year,
  };
}

export function formatDate(dateInput: DateInput, locale: AppLocale): string {
  const date = toValidDate(dateInput);
  if (!date) return "";

  const { day, month, year } = splitDateParts(date, locale);
  if (!day || !month || !year) return "";

  if (locale === "sr") {
    return `${day}. ${month} ${year}.`;
  }

  return `${month} ${day}, ${year}`;
}

export function formatDateTime(dateInput: DateInput, locale: AppLocale): string {
  const date = toValidDate(dateInput);
  if (!date) return "";

  const dateLabel = formatDate(date, locale);
  if (!dateLabel) return "";

  const timeFormatter = new Intl.DateTimeFormat(locale === "sr" ? "sr-Latn" : "en-US", {
    hour: locale === "sr" ? "2-digit" : "numeric",
    minute: "2-digit",
    hour12: locale === "en",
  });

  const timeLabel = timeFormatter.format(date);
  if (!timeLabel) return dateLabel;
  return locale === "en" ? `${dateLabel}, ${timeLabel}` : `${dateLabel} ${timeLabel}`;
}
