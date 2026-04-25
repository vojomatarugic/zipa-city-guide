import { useEffect, useMemo, useState } from "react";
import { useLocation as useRouterLocation } from "react-router";
import { MapPinned, X } from "lucide-react";
import { useLocation, type City } from "../contexts/LocationContext";
import { useT } from "../hooks/useT";
import newCityModalBg from "../assets/location-modal-bg.png";
import {
  getAvailableCities,
  normalizeCityForCompare,
} from "../utils/city";
import { getTopLevelPageCategory } from "../utils/eventPageCategory";
import * as eventService from "../utils/eventService";
import type { Item } from "../utils/dataService";

export function CityModal() {
  const routeLocation = useRouterLocation();
  const {
    isCityPopupOpen,
    setIsCityPopupOpen,
    citySearchQuery,
    setCitySearchQuery,
    selectedCity,
    setSelectedCity,
  } = useLocation();
  const { t, language } = useT();
  const [allEvents, setAllEvents] = useState<Item[]>([]);

  useEffect(() => {
    if (!isCityPopupOpen) return;
    let cancelled = false;

    async function fetchEventsForCities() {
      const fetchedEvents = await eventService.getEvents("all");
      if (cancelled) return;
      setAllEvents(
        fetchedEvents.filter((event) => event.status === "approved"),
      );
    }

    fetchEventsForCities();
    return () => {
      cancelled = true;
    };
  }, [isCityPopupOpen]);

  const pageEvents = useMemo(() => {
    const path = routeLocation.pathname.toLowerCase();
    if (path.startsWith("/cinema")) {
      return allEvents.filter(
        (event) => getTopLevelPageCategory(event) === "cinema",
      );
    }
    if (path.startsWith("/theatre")) {
      return allEvents.filter(
        (event) => getTopLevelPageCategory(event) === "theatre",
      );
    }
    if (path.startsWith("/concerts")) {
      return allEvents.filter(
        (event) => getTopLevelPageCategory(event) === "concerts",
      );
    }
    if (path.startsWith("/events")) {
      return allEvents.filter(
        (event) => getTopLevelPageCategory(event) === "events",
      );
    }
    return allEvents;
  }, [allEvents, routeLocation.pathname]);

  const availableCities = useMemo(
    () => getAvailableCities(pageEvents),
    [pageEvents],
  );

  const filteredCities = useMemo(() => {
    const normalizedQuery = normalizeCityForCompare(citySearchQuery);
    if (!normalizedQuery) return availableCities;
    return availableCities.filter((city) =>
      normalizeCityForCompare(city.label).includes(normalizedQuery),
    );
  }, [availableCities, citySearchQuery]);

  if (!isCityPopupOpen) return null;

  return (
    <div
      className="fixed inset-0 flex items-start justify-center z-50"
      onClick={() => setIsCityPopupOpen(false)}
      style={{
        padding: "20px",
        paddingTop: "100px",
        background: "rgba(0, 0, 0, 0.65)",
        animation: "fadeIn 0.2s ease-out",
      }}
    >
      <div
        className="rounded-md shadow-2xl w-full max-w-xl overflow-hidden relative"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: `url(${newCityModalBg}) center/cover`,
          backgroundColor: "#f8f9fb",
          animation: "slideDown 0.5s ease-out",
        }}
      >
        {/* Close Button */}
        <button
          onClick={() => setIsCityPopupOpen(false)}
          className="absolute top-6 right-6 p-2 hover:bg-black/10 rounded-full transition-colors z-10"
          style={{
            border: "none",
            background: "rgba(255, 255, 255, 0.2)",
            cursor: "pointer",
          }}
        >
          <X size={22} style={{ color: "#1a1a1a" }} />
        </button>

        {/* Content Container */}
        <div
          className="relative px-8 py-8"
          style={{
            zIndex: 1,
            backgroundImage: `url(${newCityModalBg})`,
            backgroundSize: "cover",
            backgroundPosition: "bottom",
            backgroundRepeat: "no-repeat",
          }}
        >
          {/* Search Input */}
          <div className="flex items-center gap-2 px-3 py-2 bg-white rounded-md shadow-sm">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#9CA3AF"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
            <input
              type="text"
              placeholder={t("enterYourCity")}
              value={citySearchQuery}
              onChange={(e) => {
                setCitySearchQuery(e.target.value);
              }}
              onKeyDown={(e) => {
                if (e.key !== "Enter") return;
                const normalizedQuery = normalizeCityForCompare(citySearchQuery);
                const match =
                  filteredCities.find(
                    (city) => normalizeCityForCompare(city.label) === normalizedQuery,
                  ) || filteredCities[0];
                if (!match) return;
                setSelectedCity(match.label as City);
                setIsCityPopupOpen(false);
                setCitySearchQuery("");
              }}
              list="city-modal-options"
              className="flex-1 bg-transparent border-0 outline-none"
              style={{
                fontSize: "15px",
                fontWeight: 400,
                color: "#1a1a1a",
              }}
            />
            <datalist id="city-modal-options">
              {filteredCities.map((city) => (
                <option key={city.key} value={city.label} />
              ))}
            </datalist>
            <button
              type="button"
              aria-label={language === "sr" ? "Trenutna lokacija" : "Current location"}
              onClick={() => {
                setSelectedCity("Banja Luka");
                setIsCityPopupOpen(false);
                setCitySearchQuery("");
              }}
              className="flex items-center justify-center h-9 w-9 hover:opacity-80 transition-opacity"
              style={{
                border: "none",
                background: "transparent",
                cursor: "pointer",
                color: "#1E88E5",
              }}
            >
              <MapPinned size={17} />
            </button>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        @keyframes slideDown {
          from {
            transform: translateY(-100vh);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}
