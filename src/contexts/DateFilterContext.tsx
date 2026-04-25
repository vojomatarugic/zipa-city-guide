import { createContext, ReactNode, useContext, useState } from "react";

interface DateFilterContextType {
  isDatePickerOpen: boolean;
  setIsDatePickerOpen: (open: boolean) => void;
  selectedStartDate: Date | null;
  setSelectedStartDate: (date: Date | null) => void;
  selectedEndDate: Date | null;
  setSelectedEndDate: (date: Date | null) => void;
  selectedDateRange: string;
  setSelectedDateRange: (value: string) => void;
  currentMonth: Date;
  setCurrentMonth: (date: Date) => void;
  hoverDate: Date | null;
  setHoverDate: (date: Date | null) => void;
}

const DateFilterContext = createContext<DateFilterContextType | undefined>(
  undefined,
);

export function DateFilterProvider({ children }: { children: ReactNode }) {
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [selectedStartDate, setSelectedStartDate] = useState<Date | null>(null);
  const [selectedEndDate, setSelectedEndDate] = useState<Date | null>(null);
  const [selectedDateRange, setSelectedDateRange] = useState("");
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [hoverDate, setHoverDate] = useState<Date | null>(null);

  return (
    <DateFilterContext.Provider
      value={{
        isDatePickerOpen,
        setIsDatePickerOpen,
        selectedStartDate,
        setSelectedStartDate,
        selectedEndDate,
        setSelectedEndDate,
        selectedDateRange,
        setSelectedDateRange,
        currentMonth,
        setCurrentMonth,
        hoverDate,
        setHoverDate,
      }}
    >
      {children}
    </DateFilterContext.Provider>
  );
}

export function useDateFilter() {
  const context = useContext(DateFilterContext);
  if (!context) {
    throw new Error("useDateFilter must be used within DateFilterProvider");
  }
  return context;
}
