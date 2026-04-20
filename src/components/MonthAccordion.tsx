/**
 * MonthAccordion - Collapsible month sections for "All" event pages.
 * First month that contains events is expanded by default; others collapsed.
 * Shows max INITIAL_SHOW events with "Show more" button.
 */
import { useState } from "react";
import { Calendar, ChevronDown, ChevronRight } from "lucide-react";
import { Item } from "../utils/dataService";
import { pluralize, type PluralWordForms } from "../utils/pluralize";

const MORE_EVENTS_LABEL: PluralWordForms = {
  sr: { one: "događaj", few: "događaja", many: "događaja" },
  en: { one: "event", many: "events" },
};

function countLocale(language: string): "sr" | "en" {
  return language === "en" ? "en" : "sr";
}

const INITIAL_SHOW = 6;

const MONTH_NAMES_SR = [
  'Januar', 'Februar', 'Mart', 'April', 'Maj', 'Jun',
  'Jul', 'Avgust', 'Septembar', 'Oktobar', 'Novembar', 'Decembar'
];
const MONTH_NAMES_EN = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

interface MonthAccordionProps {
  events: Item[];
  language: string;
  accentColor: string;
  badgeBg: string;
  badgeBorder: string;
  countPluralForms: PluralWordForms;
  renderCard: (event: Item) => React.ReactNode;
}

export function MonthAccordion({
  events,
  language,
  accentColor,
  badgeBg,
  badgeBorder,
  countPluralForms,
  renderCard,
}: MonthAccordionProps) {
  const locale = countLocale(language);
  const countWord = (n: number) => pluralize(n, locale, countPluralForms);
  // Group events by month
  const grouped: Record<string, Item[]> = {};
  const monthOrder: string[] = [];

  events.forEach((event) => {
    if (!event.start_at) return;
    const date = new Date(event.start_at);
    const key = `${date.getFullYear()}-${String(date.getMonth()).padStart(2, '0')}`;
    if (!grouped[key]) {
      grouped[key] = [];
      monthOrder.push(key);
    }
    grouped[key].push(event);
  });

  const firstMonthKey = monthOrder[0] ?? null;

  return (
    <>
      <div className="mb-6">
        <p className="text-sm" style={{ color: "#6B7280" }}>
          {language === "sr"
            ? `Pronađeno ${events.length} ${countWord(events.length)}`
            : `Found ${events.length} ${countWord(events.length)}`}
        </p>
      </div>

      {monthOrder.map((key) => (
        <MonthSection
          key={key}
          monthKey={key}
          events={grouped[key]}
          defaultExpanded={key === firstMonthKey}
          language={language}
          accentColor={accentColor}
          badgeBg={badgeBg}
          badgeBorder={badgeBorder}
          countPluralForms={countPluralForms}
          renderCard={renderCard}
        />
      ))}
    </>
  );
}

function MonthSection({
  monthKey,
  events,
  defaultExpanded,
  language,
  accentColor,
  badgeBg,
  badgeBorder,
  countPluralForms,
  renderCard,
}: {
  monthKey: string;
  events: Item[];
  defaultExpanded: boolean;
  language: string;
  accentColor: string;
  badgeBg: string;
  badgeBorder: string;
  countPluralForms: PluralWordForms;
  renderCard: (event: Item) => React.ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(defaultExpanded);
  const [showAll, setShowAll] = useState(false);
  const locale = countLocale(language);
  const countWord = (n: number) => pluralize(n, locale, countPluralForms);

  const [yearStr, monthStr] = monthKey.split('-');
  const monthIndex = parseInt(monthStr, 10);
  const year = parseInt(yearStr, 10);
  const monthName = language === 'sr' ? MONTH_NAMES_SR[monthIndex] : MONTH_NAMES_EN[monthIndex];
  const currentYear = new Date().getFullYear();
  const label = year === currentYear ? monthName : `${monthName} ${year}`;

  const visibleEvents = showAll ? events : events.slice(0, INITIAL_SHOW);
  const hasMore = events.length > INITIAL_SHOW;

  return (
    <div className="mb-8">
      {/* Month Header — clickable */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-3 mb-4 w-full text-left cursor-pointer"
        style={{ background: "none", border: "none", padding: 0 }}
      >
        <div
          className="flex items-center gap-2 px-4 py-2 rounded-xl"
          style={{ background: `linear-gradient(135deg, ${accentColor} 0%, ${accentColor}CC 100%)` }}
        >
          {isOpen ? (
            <ChevronDown size={18} style={{ color: '#FFFFFF' }} />
          ) : (
            <ChevronRight size={18} style={{ color: '#FFFFFF' }} />
          )}
          <Calendar size={18} style={{ color: '#FFFFFF' }} />
          <span
            style={{
              fontSize: '18px',
              fontWeight: 700,
              color: '#FFFFFF',
              letterSpacing: '0.3px',
            }}
          >
            {label}
          </span>
        </div>
        <div className="flex-1 h-px" style={{ background: '#E5E7EB' }} />
        <span
          className="text-xs font-medium px-2 py-1 rounded-full"
          style={{ background: badgeBg, color: accentColor, border: `1px solid ${badgeBorder}` }}
        >
          {events.length} {countWord(events.length)}
        </span>
      </button>

      {/* Collapsible content */}
      {isOpen && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {visibleEvents.map((event) => renderCard(event))}
          </div>

          {hasMore && !showAll && (
            <div className="flex justify-center mt-6">
              <button
                onClick={() => setShowAll(true)}
                className="px-6 py-2.5 rounded-lg text-sm font-medium transition-all hover:opacity-90"
                style={{
                  background: 'transparent',
                  color: accentColor,
                  border: `2px solid ${accentColor}`,
                  cursor: 'pointer',
                }}
              >
                {language === "sr"
                  ? `Prikaži još ${events.length - INITIAL_SHOW} ${pluralize(
                      events.length - INITIAL_SHOW,
                      "sr",
                      MORE_EVENTS_LABEL,
                    )}`
                  : `Show ${events.length - INITIAL_SHOW} more ${pluralize(
                      events.length - INITIAL_SHOW,
                      "en",
                      MORE_EVENTS_LABEL,
                    )}`}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
