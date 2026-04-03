import { MapPin, X } from "lucide-react";
import { useLocation, type City } from "../contexts/LocationContext";
import { useT } from "../hooks/useT";
import newCityModalBg from "../assets/6723694754a898f8b40bab31482fee544e9de39b.png";

export function CityModal() {
  const {
    isCityPopupOpen,
    setIsCityPopupOpen,
    citySearchQuery,
    setCitySearchQuery,
    selectedCity,
    setSelectedCity,
  } = useLocation();
  const { t } = useT();

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
        className="rounded-md shadow-2xl w-full max-w-2xl overflow-hidden relative"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxHeight: "90vh",
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
          {/* Title */}
          <h2
            className="text-center text-2xl font-bold mb-6"
            style={{
              color: "#1a1a1a",
              textShadow: "0 2px 4px rgba(0, 0, 0, 0.1)",
            }}
          >
            {t("allEventsInYourCity")}
          </h2>

          {/* Search Input */}
          <div className="flex items-center gap-3 px-4 py-3 bg-white rounded-md shadow-sm mb-6">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
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
              onChange={(e) =>
                setCitySearchQuery(e.target.value)
              }
              className="flex-1 bg-transparent border-0 outline-none"
              style={{
                fontSize: "15px",
                fontWeight: 400,
                color: "#1a1a1a",
              }}
            />
            <button
              onClick={() => {
                setSelectedCity("Banja Luka");
                setIsCityPopupOpen(false);
                setCitySearchQuery("");
              }}
              className="flex items-center gap-2 hover:opacity-80 transition-opacity"
              style={{
                border: "none",
                background: "transparent",
                cursor: "pointer",
                color: "#1E88E5",
                fontSize: "14px",
                fontWeight: 500,
              }}
            >
              <MapPin size={16} />
              {t("currentLocation")}
            </button>
          </div>

          {/* Section Title */}
          <h3
            className="text-lg font-semibold mb-2"
            style={{ color: "#1a1a1a" }}
          >
            {t("exploreCitiesNearYou")}
          </h3>

          {/* Cities Grid */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            {[
              { nameKey: "citySarajevo", events: "29+" },
              { nameKey: "cityTuzla", events: "2+" },
              { nameKey: "cityZenica", events: "7+" },
              { nameKey: "cityMostar", events: "5+" },
              { nameKey: "cityBihac", events: "1+" },
              { nameKey: "cityBanjaLuka", events: "16+" },
            ]
              .filter((city) =>
                citySearchQuery
                  ? t(city.nameKey as any)
                      .toLowerCase()
                      .includes(citySearchQuery.toLowerCase())
                  : true,
              )
              .map((city, i) => (
                <div
                  key={i}
                  className="flex items-start gap-3 p-3 rounded-md cursor-pointer transition-all"
                  style={{
                    background: "rgba(255, 255, 255, 0.7)",
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.background =
                      "rgba(255, 255, 255, 0.85)")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.background =
                      "rgba(255, 255, 255, 0.7)")
                  }
                  onClick={() => {
                    setSelectedCity(t(city.nameKey as any) as City);
                    setIsCityPopupOpen(false);
                    setCitySearchQuery("");
                  }}
                >
                  <MapPin
                    size={20}
                    style={{
                      color: "#6B7280",
                      marginTop: "2px",
                      flexShrink: 0,
                    }}
                  />
                  <div className="flex-1">
                    <div
                      className="text-sm font-semibold mb-0.5"
                      style={{ color: "#1a1a1a" }}
                    >
                      {t(city.nameKey as any)}
                    </div>
                    <div
                      className="text-xs"
                      style={{ color: "#9CA3AF" }}
                    >
                      {city.events} {t("eventCountSuffix")}
                    </div>
                  </div>
                </div>
              ))}
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