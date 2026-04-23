<section
        className="py-16"
        style={{ background: "#FFFFFF" }}
      >
        <div className="w-[60vw] mx-auto">
          <h2
            className="mb-2.5 pb-2 lg:mb-4 lg:pb-3"
            style={{
              fontSize: "24px",
              fontWeight: 600,
              color: "#8B6F47",
              textShadow: "0 2px 4px rgba(0, 0, 0, 0.1)",
            }}
          >
            {language === "sr"
              ? "Restorani u blizini"
              : "Nearby Restaurants"}
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
            {/* ⚠️ FEATURED NEARBY RESTAURANTS - OGRANIČENO NA 3 KARTICE ⚠️ */}
            {/* NOVI SADRŽAJ SE DODAJE NA /food-and-drink (glavna stranica), NE OVDJE — fiksno 3 kartice. */}
            {/* NE DODAVATI OVDJE - OVO JE FEATURED SEKCIJA SA FIKSNIH 3 KARTICE! */}
            {/* ⚠️ ZAŠTITA: .slice(0, 3) osigurava da se prikazuje MAKSIMALNO 3 kartice */}
            {[
              {
                image:
                  "https://images.unsplash.com/photo-1502301103665-0b95cc738daf?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxyZXN0YXVyYW50JTIwZm9vZCUyMHBsYXRlfGVufDF8fHx8MTczODE1ODQwMHww&ixlib=rb-4.1.0&q=80&w=1080",
                category:
                  language === "sr" ? "Lokalna" : "Local",
                priceRange: "€€",
                title:
                  language === "sr"
                    ? "Restoran Prijedor"
                    : "Restaurant Prijedor",
                location:
                  language === "sr" ? "Prijedor" : "Prijedor",
              },
              {
                image:
                  "https://images.unsplash.com/photo-1424847651672-bf20a4b0982b?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxmb29kJTIwcGxhdGUlMjBkaW5pbmd8ZW58MXx8fHwxNzM4MTU4NDAwfDA&ixlib=rb-4.1.0&q=80&w=1080",
                category:
                  language === "sr" ? "Evropska" : "European",
                priceRange: "€€€",
                title:
                  language === "sr"
                    ? "Restoran Gradiška"
                    : "Restaurant Gradiska",
                location:
                  language === "sr" ? "Gradiška" : "Gradiska",
              },
              {
                image:
                  "https://images.unsplash.com/photo-1498654896293-37aacf113fd9?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxyZXN0YXVyYW50JTIwbWVhbCUyMGRpc2h8ZW58MXx8fHwxNzM4MTU4NDAwfDA&ixlib=rb-4.1.0&q=80&w=1080",
                category:
                  language === "sr" ? "Roštilj" : "Grill",
                priceRange: "€€",
                title:
                  language === "sr"
                    ? "Roštilj Doboj"
                    : "Grill Doboj",
                location: language === "sr" ? "Doboj" : "Doboj",
              },
            ].slice(0, 3).map((restaurant, i) => (
              <div
                key={i}
                className="cursor-pointer hover:scale-[1.02] transition-all duration-300"
              >
                {/* Image */}
                <img
                  src={restaurant.image}
                  alt={restaurant.title}
                  className="w-full h-[250px] object-cover rounded-md"
                />

                {/* Content ISPOD SLIKE */}
                <div className="p-4">
                  {/* Category and Badge */}
                  <div className="flex items-center gap-2 mb-2">
                    <span
                      className="text-xs font-medium px-2 py-1 rounded"
                      style={{
                        background: "#F3F4F6",
                        color: "#8B6F47",
                      }}
                    >
                      {restaurant.category}
                    </span>
                  </div>

                  {/* Title */}
                  <h3
                    className="text-base font-semibold mb-2"
                    style={{ color: "#1a1a1a" }}
                  >
                    {restaurant.title}
                  </h3>

                  {/* Location */}
                  <div className="flex items-center gap-2">
                    <MapPin
                      size={14}
                      style={{ color: "#6B7280" }}
                    />
                    <span
                      className="text-sm"
                      style={{ color: "#6B7280" }}
                    >
                      {restaurant.address}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>