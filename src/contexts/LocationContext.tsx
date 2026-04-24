import { createContext, useContext, useState, ReactNode } from 'react';

export type City = string;

interface LocationContextType {
  selectedCity: City;
  setSelectedCity: (city: City) => void;
  getCityInLocative: (city: string) => string;
  isCityPopupOpen: boolean;
  setIsCityPopupOpen: (open: boolean) => void;
  citySearchQuery: string;
  setCitySearchQuery: (query: string) => void;
}

const LocationContext = createContext<LocationContextType | undefined>(undefined);

export function LocationProvider({ children }: { children: ReactNode }) {
  const [selectedCity, setSelectedCity] = useState<City>('Banja Luka');
  const [isCityPopupOpen, setIsCityPopupOpen] = useState(false);
  const [citySearchQuery, setCitySearchQuery] = useState("");

  // City name mapping to locative case (u + city name)
  const cityLocativeMap: Record<string, string> = {
    'Banja Luka': 'Banjoj Luci',
    'Prijedor': 'Prijedoru',
    'Gradiška': 'Gradišci',
    'Prnjavor': 'Prnjavoru',
    'Doboj': 'Doboju',
  };

  // Get city name in locative case for Serbian
  const getCityInLocative = (city: string) => {
    return cityLocativeMap[city] || city;
  };

  return (
    <LocationContext.Provider value={{ 
      selectedCity, 
      setSelectedCity, 
      getCityInLocative,
      isCityPopupOpen,
      setIsCityPopupOpen,
      citySearchQuery,
      setCitySearchQuery
    }}>
      {children}
    </LocationContext.Provider>
  );
}

export function useLocation() {
  const context = useContext(LocationContext);
  if (context === undefined) {
    throw new Error('useLocation must be used within a LocationProvider');
  }
  return context;
}