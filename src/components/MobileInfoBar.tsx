import { CalendarDays } from "lucide-react";
import { useMemo } from "react";
import { useLocation } from "../contexts/LocationContext";
import { useDateFilter } from "../contexts/DateFilterContext";
import { useLanguage } from "../contexts/LanguageContext";
import { useT } from "../hooks/useT";

function formatShortDate(date: Date) {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${day}.${month}.`;
}

function formatDateLabel(startDate: Date | null, endDate: Date | null) {
  if (!startDate) return null;
  if (!endDate || startDate.toDateString() === endDate.toDateString()) {
    return formatShortDate(startDate);
  }
  return `${formatShortDate(startDate)}-${formatShortDate(endDate)}`;
}

export function MobileInfoBar() {
  const { language } = useT();
  const { language: activeLanguage, setLanguage } = useLanguage();
  const { selectedCity, setIsCityPopupOpen } = useLocation();
  const { selectedStartDate, selectedEndDate, setIsDatePickerOpen } =
    useDateFilter();

  const dateLabel = useMemo(
    () => formatDateLabel(selectedStartDate, selectedEndDate),
    [selectedStartDate, selectedEndDate],
  );

  return (
    <div
      className="lg:hidden sticky top-16 z-40 w-full bg-white border-b border-gray-200 shadow-sm"
      role="region"
      aria-label="Mobile info bar"
    >
      <div className="w-full">
        <div className="px-4 py-2 flex w-full items-center text-sm text-[#1a1a1a]">
          <button
            type="button"
            onClick={() => setIsCityPopupOpen(true)}
            className="flex-1 min-w-0 h-10 inline-flex items-center text-left whitespace-nowrap"
          >
            <span className="truncate">{selectedCity}</span>
          </button>

          <div className="shrink-0 flex items-center gap-5 pl-4">
            <button
              type="button"
              onClick={() => setIsDatePickerOpen(true)}
              className="h-10 shrink-0 inline-flex items-center gap-1.5 whitespace-nowrap"
            >
              <span>{dateLabel || (language === "sr" ? "Datum" : "Date")}</span>
              <CalendarDays className="h-4 w-4 text-[#0E3DC5]" />
            </button>

            <button
              type="button"
              onClick={() => setLanguage(activeLanguage === "sr" ? "en" : "sr")}
              className="h-10 shrink-0 inline-flex items-center text-sm font-semibold text-[#0E3DC5] whitespace-nowrap"
            >
              {activeLanguage === "sr" ? "SR" : "EN"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
