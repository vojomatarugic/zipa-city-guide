/**
 * MonthAccordion - Collapsible month sections for "All" event pages.
 * Current month is expanded by default, others collapsed.
 * Shows max INITIAL_SHOW events with "Show more" button.
 */
import { useState } from "react";
import { Calendar, ChevronDown, ChevronRight } from "lucide-react";
import { Item } from "../utils/dataService";

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
  countLabelSr: string;
  countLabelEn: string;
  renderCard: (event: Item) => React.ReactNode;
}

export function MonthAccordion({
  events,
  language,
  accentColor,
  badgeBg,
  badgeBorder,
  countLabelSr,
  countLabelEn,
  renderCard,
}: MonthAccordionProps) {
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

  // Current month key
  const now = new Date();
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth()).padStart(2, '0')}`;

  return (
    <>
      <div className="mb-6">
        <p className="text-sm" style={{ color: "#6B7280" }}>
          {language === "sr"
            ? `Pronađeno ${events.length} ${countLabelSr}`
            : `Found ${events.length} ${countLabelEn}`}
        </p>
      </div>

      {monthOrder.map((key) => (
        <MonthSection
          key={key}
          monthKey={key}
          events={grouped[key]}
          isCurrentMonth={key === currentMonthKey}
          language={language}
          accentColor={accentColor}
          badgeBg={badgeBg}
          badgeBorder={badgeBorder}
          countLabelSr={countLabelSr}
          countLabelEn={countLabelEn}
          renderCard={renderCard}
        />
      ))}
    </>
  );
}

function MonthSection({
  monthKey,
  events,
  isCurrentMonth,
  language,
  accentColor,
  badgeBg,
  badgeBorder,
  countLabelSr,
  countLabelEn,
  renderCard,
}: {
  monthKey: string;
  events: Item[];
  isCurrentMonth: boolean;
  language: string;
  accentColor: string;
  badgeBg: string;
  badgeBorder: string;
  countLabelSr: string;
  countLabelEn: string;
  renderCard: (event: Item) => React.ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(isCurrentMonth);
  const [showAll, setShowAll] = useState(false);

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
          {events.length} {language === 'sr' ? countLabelSr : countLabelEn}
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
                {language === 'sr'
                  ? `Prikaži još ${events.length - INITIAL_SHOW} događaja`
                  : `Show ${events.length - INITIAL_SHOW} more events`}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
