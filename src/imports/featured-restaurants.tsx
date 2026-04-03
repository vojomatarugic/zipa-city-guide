<section
        className="py-16"
        style={{ background: "#FAF7F2" }}
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
              ? "Istaknuti restorani"
              : "Featured Restaurants"}
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
            {/* ⚠️ FEATURED RESTAURANTS - OGRANIČENO NA 4 KARTICE ⚠️ */}
            {/* NOVI RESTORAN SE DODAJE SAMO NA /restaurants/all STRANICU! */}
            {/* NE DODAVATI OVDJE - OVO JE FEATURED SEKCIJA SA FIKSNIH 4 KARTICE! */}
            {/* ⚠️ ZAŠTITA: .slice(0, 4) osigurava da se prikazuje MAKSIMALNO 4 kartice */}
            {[
              {
                image:
                  "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxyZXN0YXVyYW50JTIwaW50ZXJpb3IlMjBkaW5pbmd8ZW58MXx8fHwxNzM4MTU4NDAwfDA&ixlib=rb-4.1.0&q=80&w=1080",
                category:
                  language === "sr"
                    ? "Lokalna kuhinja"
                    : "Local Cuisine",
                priceRange: "€€€",
                title:
                  language === "sr"
                    ? "Lunch Bar Ara"
                    : "Lunch Bar Ara",
                location:
                  language === "sr"
                    ? "Centar grada"
                    : "City Center",
                hours:
                  language === "sr"
                    ? "Pon-Sub: 08:00 - 23:00"
                    : "Mon-Sat: 08:00 - 23:00",
              },
              {
                image:
                  "https://images.unsplash.com/photo-1552566626-52f8b828add9?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxyZXN0YXVyYW50JTIwZ3JpbGwlMjBtZWF0fGVufDF8fHx8MTczODE1ODQwMHww&ixlib=rb-4.1.0&q=80&w=1080",
                category:
                  language === "sr" ? "Roštilj" : "Grill",
                priceRange: "€€",
                title:
                  language === "sr"
                    ? "Staro Bure"
                    : "Staro Bure",
                location:
                  language === "sr"
                    ? "Nova Varoš"
                    : "Nova Varos",
                hours:
                  language === "sr"
                    ? "Svakog dana: 12:00 - 00:00"
                    : "Every day: 12:00 - 00:00",
              },
              {
                image:
                  "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxyZXN0YXVyYW50JTIwaXRhbGljJTIwZm9vZHxlbnwxfHx8fDE3MzgxNTg0MDB8MA&ixlib=rb-4.1.0&q=80&w=1080",
                category:
                  language === "sr" ? "Italijanska" : "Italian",
                priceRange: "€€€",
                title:
                  language === "sr"
                    ? "Gatto Trattoria"
                    : "Gatto Trattoria",
                location:
                  language === "sr"
                    ? "Centar grada"
                    : "City Center",
                hours:
                  language === "sr"
                    ? "Uto-Ned: 11:00 - 23:00"
                    : "Tue-Sun: 11:00 - 23:00",
              },
              {
                image:
                  "https://images.unsplash.com/photo-1514933651103-005eec06c04b?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxyZXN0YXVyYW50JTIwZGluaW5nJTIwZm9vZHxlbnwxfHx8fDE3MzgxNTg0MDB8MA&ixlib=rb-4.1.0&q=80&w=1080",
                category:
                  language === "sr"
                    ? "Lokalna kuhinja"
                    : "Local Cuisine",
                priceRange: "€€",
                title:
                  language === "sr" ? "Kod Brke" : "Kod Brke",
                location:
                  language === "sr"
                    ? "Centar grada"
                    : "City Center",
                hours:
                  language === "sr"
                    ? "Pon-Sub: 10:00 - 22:00"
                    : "Mon-Sat: 10:00 - 22:00",
              },
            ].slice(0, 4).map((restaurant, i) => (
              <div
                key={i}
                className="cursor-pointer hover:scale-[1.02] transition-all duration-300"
              >
                <img
                  src={restaurant.image}
                  alt={restaurant.title}
                  className="w-full h-[400px] object-cover rounded-md"
                />
                <div className="p-4">
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
                  <h3
                    className="text-base font-semibold mb-2"
                    style={{ color: "#1a1a1a" }}
                  >
                    {restaurant.title}
                  </h3>
                  <div className="flex items-center gap-2 mb-1">
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
                  <div className="flex items-center gap-2">
                    <Clock
                      size={14}
                      style={{ color: "#6B7280" }}
                    />
                    <span
                      className="text-sm"
                      style={{ color: "#6B7280" }}
                    >
                      {restaurant.hours}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>