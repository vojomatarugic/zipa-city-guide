import { useState, useRef, useEffect, type ReactElement } from "react";
import { Star, X } from "lucide-react";
import { useLanguage } from "../contexts/LanguageContext";

interface GalleryCard {
  type: "image" | "testimonial";
  image?: string;
  avatar?: string;
  name: string;
  time: string;
  height: string;
  quote?: string;
  rating?: number;
}

interface SocialProofGalleryProps {
  language: string;
}

// Helper function to generate initials from name
const getInitials = (name: string) => {
  return name
    .split(" ")
    .map((word) => word[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
};

// Helper function to generate avatar background color from name
const getAvatarColor = (name: string) => {
  const colors = [
    "#0E3DC5",
    "#FF5722",
    "#4CAF50",
    "#9C27B0",
    "#FF9800",
    "#E91E63",
  ];
  const index = name.charCodeAt(0) % colors.length;
  return colors[index];
};

export function SocialProofGallery({
  language,
}: SocialProofGalleryProps) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxImage, setLightboxImage] = useState<
    string | null
  >(null);
  const [lightboxTitle, setLightboxTitle] =
    useState<string>("");
  const [lightboxAuthor, setLightboxAuthor] =
    useState<string>("");

  const columns: GalleryCard[][] = [
    // Column 1
    [
      {
        type: "image",
        image:
          "https://images.unsplash.com/photo-1672841821756-fc04525771c2?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjb25jZXJ0JTIwY3Jvd2QlMjBtdXNpYyUyMGZlc3RpdmFsfGVufDF8fHx8MTc2OTQzOTM3MXww&ixlib=rb-4.1.0&q=80&w=1080",
        avatar:
          "https://ui-avatars.com/api/?name=Marko+Petrovic&background=0E3DC5&color=fff",
        name: "Marko Petrović",
        time: "3 days ago",
        height: "340px",
      },
      {
        type: "testimonial",
        quote:
          language === "sr"
            ? "Nevjerovatno iskustvo! Najbolji vodič kroz grad."
            : "Amazing experience! Best city guide ever.",
        name: "Ana Marković",
        time: "5 days ago",
        rating: 5,
        height: "240px",
      },
    ],
    // Column 2
    [
      {
        type: "testimonial",
        quote:
          language === "sr"
            ? "Pronašao sam najbolje događaje u gradu zahvaljujući ovoj aplikaciji!"
            : "Found the best events in the city thanks to this app!",
        name: "Stefan Ilić",
        time: "1 week ago",
        rating: 5,
        height: "260px",
      },
      {
        type: "image",
        image:
          "https://images.unsplash.com/photo-1627858034922-72a657d6b3c2?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxyZXN0YXVyYW50JTIwZGlubmVyJTIwZm9vZHxlbnwxfHx8fDE3Njk0MzkzNzF8MA&ixlib=rb-4.1.0&q=80&w=1080",
        avatar:
          "https://ui-avatars.com/api/?name=Jelena+Jovic&background=FF5722&color=fff",
        name: "Jelena Jović",
        time: "2 days ago",
        height: "320px",
      },
    ],
    // Column 3
    [
      {
        type: "image",
        image:
          "https://images.unsplash.com/photo-1763630052152-e787f9d45e54?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxuaWdodGNsdWIlMjBwYXJ0eSUyMGNlbGVicmF0aW9ufGVufDF8fHx8MTc2OTQzOTM3MXww&ixlib=rb-4.1.0&q=80&w=1080",
        avatar:
          "https://ui-avatars.com/api/?name=Nikola+Savic&background=4CAF50&color=fff",
        name: "Nikola Savić",
        time: "4 days ago",
        height: "360px",
      },
      {
        type: "testimonial",
        quote:
          language === "sr"
            ? "Svaki vikend nova avantura!"
            : "A new adventure every weekend!",
        name: "Maja Nikolić",
        time: "6 days ago",
        rating: 5,
        height: "220px",
      },
    ],
    // Column 4
    [
      {
        type: "testimonial",
        quote:
          language === "sr"
            ? "Aplikacija koja mi je promijenila način kako istražujem grad. Preporučujem!"
            : "The app that changed how I explore the city. Highly recommended!",
        name: "Dušan Popović",
        time: "3 days ago",
        rating: 5,
        height: "280px",
      },
      {
        type: "image",
        image:
          "https://images.unsplash.com/photo-1539964604210-db87088e0c2c?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx0aGVhdHJlJTIwcGVyZm9ybWFuY2UlMjBzdGFnZXxlbnwxfHx8fDE3NjkzNDAzNDB8MA&ixlib=rb-4.1.0&q=80&w=1080",
        avatar:
          "https://ui-avatars.com/api/?name=Ivan+Lukic&background=9C27B0&color=fff",
        name: "Ivan Lukić",
        time: "1 week ago",
        height: "300px",
      },
    ],
    // Column 5
    [
      {
        type: "image",
        image:
          "https://images.unsplash.com/photo-1727942019403-cf4aecfc3276?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjaXR5JTIwc2t5bGluZSUyMGV2ZW5pbmd8ZW58MXx8fHwxNzY5NDAyMDU3fDA&ixlib=rb-4.1.0&q=80&w=1080",
        avatar:
          "https://ui-avatars.com/api/?name=Milica+Jankovic&background=FF9800&color=fff",
        name: "Milica Janković",
        time: "2 days ago",
        height: "330px",
      },
      {
        type: "testimonial",
        quote:
          language === "sr"
            ? "Odlična platforma za pronalaženje najboljih mjesta!"
            : "Excellent platform for finding the best places!",
        name: "Petar Đorđević",
        time: "4 days ago",
        rating: 5,
        height: "250px",
      },
    ],
    // Column 6
    [
      {
        type: "testimonial",
        quote:
          language === "sr"
            ? "Nikad nisam propustio dobar događaj od kada koristim ovu aplikaciju."
            : "Never missed a great event since using this app.",
        name: "Ivana Đukić",
        time: "5 days ago",
        rating: 5,
        height: "270px",
      },
      {
        type: "image",
        image:
          "https://images.unsplash.com/photo-1491013438744-0aa52aff4020?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxoYXBweSUyMHBlb3BsZSUyMGZyaWVuZHN8ZW58MXx8fHwxNzY5NDE2NDkzfDA&ixlib=rb-4.1.0&q=80&w=1080",
        avatar:
          "https://ui-avatars.com/api/?name=Aleksandar+Milic&background=E91E63&color=fff",
        name: "Aleksandar Milić",
        time: "1 week ago",
        height: "310px",
      },
    ],
  ];

  const renderCard = (
    card: GalleryCard,
    colIndex: number,
    cardIndex: number,
    isDuplicate: boolean = false,
  ) => {
    const key = isDuplicate
      ? `card-duplicate-${colIndex}-${cardIndex}`
      : `card-${colIndex}-${cardIndex}`;

    return (
      <div
        key={key}
        className="gallery-card cursor-pointer"
        style={{ height: card.height }}
        onClick={() => {
          if (card.type === "image" && card.image) {
            setLightboxImage(card.image);
            setLightboxTitle(card.name);
            setLightboxAuthor(card.time);
            setLightboxOpen(true);
          }
        }}
      >
        {card.type === "image" ? (
          <div
            className="relative w-full h-full overflow-hidden"
            style={{
              boxShadow: "0 4px 16px rgba(0, 0, 0, 0.08)",
              borderRadius: "18px",
            }}
          >
            <img
              src={card.image}
              alt={card.name}
              className="w-full h-full object-cover"
            />
            <div
              className="absolute inset-0"
              style={{
                background:
                  "linear-gradient(to top, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0) 50%)",
              }}
            />
            <div className="absolute bottom-4 left-4 flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-full border-2 border-white flex items-center justify-center"
                style={{
                  backgroundColor: getAvatarColor(card.name),
                  color: "white",
                  fontSize: "14px",
                  fontWeight: "600",
                }}
              >
                {getInitials(card.name)}
              </div>
              <div>
                <div
                  className="font-semibold text-white"
                  style={{
                    fontSize: "14px",
                    textShadow: "0 2px 4px rgba(0,0,0,0.4)",
                  }}
                >
                  {card.name}
                </div>
                <div
                  className="text-white/90"
                  style={{
                    fontSize: "12px",
                    textShadow: "0 2px 4px rgba(0,0,0,0.4)",
                  }}
                >
                  {card.time}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div
            className="w-full h-full bg-white p-5 flex flex-col justify-between"
            style={{
              boxShadow: "0 4px 16px rgba(0, 0, 0, 0.08)",
              borderRadius: "18px",
            }}
          >
            <div>
              <div className="flex gap-0.5 mb-3">
                {[...Array(card.rating)].map((_, i) => (
                  <Star
                    key={i}
                    size={16}
                    fill="#FFD700"
                    stroke="#FFD700"
                  />
                ))}
              </div>
              <p
                style={{
                  fontSize: "14px",
                  fontWeight: 400,
                  color: "#1a1a1a",
                  lineHeight: "1.5",
                  marginBottom: "12px",
                }}
              >
                "{card.quote}"
              </p>
            </div>
            <div>
              <div
                className="font-semibold mb-0.5"
                style={{ fontSize: "13px", color: "#1a1a1a" }}
              >
                {card.name}
              </div>
              <div
                style={{ fontSize: "12px", color: "#9CA3AF" }}
              >
                {card.time}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      <section
        className="py-16"
        style={{
          background: "#FFFFFF",
          width: "100%",
          overflowX: "hidden",
        }}
      >
        <div className="max-w-7xl mx-auto px-4 mb-10">
          <h2
            className="text-center mb-3"
            style={{
              fontSize: "36px",
              fontWeight: 700,
              color: "#1a1a1a",
              textShadow: "0 2px 4px rgba(0, 0, 0, 0.1)",
            }}
          >
            {language === "sr"
              ? "Mjesto gdje grad živi"
              : "The place where the city lives"}
          </h2>
          <p
            className="text-center"
            style={{
              fontSize: "16px",
              fontWeight: 400,
              color: "#6B7280",
              maxWidth: "600px",
              margin: "0 auto",
            }}
          >
            {language === "sr"
              ? "Pridružite se ljudima koji pretvaraju trenutke u nezaboravne uspomene."
              : "Join the people turning moments into unforgettable memories."}
          </p>
        </div>

        <InfiniteScrollGallery
          columns={columns}
          renderCard={renderCard}
        />
      </section>

      {/* Lightbox Modal */}
      {lightboxOpen && lightboxImage && (
        <div
          className="fixed inset-0 flex items-center justify-center z-50"
          style={{
            background: "rgba(0, 0, 0, 0.9)",
            backdropFilter: "blur(4px)",
          }}
          onClick={() => setLightboxOpen(false)}
        >
          <button
            onClick={() => setLightboxOpen(false)}
            className="absolute top-6 right-6 p-3 hover:bg-white/10 rounded-full transition-colors"
            style={{
              border: "none",
              background: "rgba(255, 255, 255, 0.1)",
              cursor: "pointer",
            }}
          >
            <X size={28} style={{ color: "white" }} />
          </button>

          <div
            className="relative max-w-5xl max-h-[85vh] mx-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={lightboxImage}
              alt={lightboxTitle}
              className="max-w-full max-h-[85vh] object-contain"
              style={{
                borderRadius: "12px",
                boxShadow: "0 25px 50px rgba(0, 0, 0, 0.5)",
              }}
            />
            <div
              className="absolute bottom-6 left-6 bg-white/95 backdrop-blur-sm px-4 py-3"
              style={{ borderRadius: "12px" }}
            >
              <div
                className="font-semibold"
                style={{ fontSize: "16px", color: "#1a1a1a" }}
              >
                {lightboxTitle}
              </div>
              <div
                style={{ fontSize: "14px", color: "#6B7280" }}
              >
                {lightboxAuthor}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// Infinite Scroll Gallery Component
interface InfiniteScrollGalleryProps {
  columns: GalleryCard[][];
  renderCard: (
    card: GalleryCard,
    colIndex: number,
    cardIndex: number,
    isDuplicate: boolean,
  ) => ReactElement;
}

export function InfiniteScrollGallery({
  columns,
  renderCard,
}: InfiniteScrollGalleryProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollIntervalRef = useRef<number | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Auto-scroll logic
    const startAutoScroll = () => {
      scrollIntervalRef.current = window.setInterval(() => {
        if (container) {
          const scrollAmount = 1; // pixels per frame
          container.scrollLeft += scrollAmount;

          // Calculate the width of one set of columns
          const oneSetWidth = columns.length * (300 + 24); // width + gap

          // Reset scroll when reaching the end of first set
          if (container.scrollLeft >= oneSetWidth) {
            container.scrollLeft = 0;
          }
        }
      }, 20); // Update every 20ms for smooth animation
    };

    startAutoScroll();

    // Pause on hover
    const handleMouseEnter = () => {
      if (scrollIntervalRef.current) {
        clearInterval(scrollIntervalRef.current);
        scrollIntervalRef.current = null;
      }
    };

    const handleMouseLeave = () => {
      startAutoScroll();
    };

    container.addEventListener("mouseenter", handleMouseEnter);
    container.addEventListener("mouseleave", handleMouseLeave);

    return () => {
      if (scrollIntervalRef.current) {
        clearInterval(scrollIntervalRef.current);
      }
      container.removeEventListener(
        "mouseenter",
        handleMouseEnter,
      );
      container.removeEventListener(
        "mouseleave",
        handleMouseLeave,
      );
    };
  }, [columns.length]);

  return (
    <div
      ref={containerRef}
      className="relative"
      style={{
        overflowX: "scroll",
        scrollbarWidth: "none",
        msOverflowStyle: "none",
        background: "#FFFFFF",
        padding: "48px",
      }}
    >
      <style>
        {`
          .scroll-container {
            display: flex;
            gap: 24px;
            background: #FFFFFF;
          }
          
          .gallery-card {
            transition: all 0.3s ease;
          }
          
          .gallery-card:hover {
            transform: scale(1.02);
          }
          
          /* Hide scrollbar for Chrome, Safari and Opera */
          div[style*=\\"overflowX\\"]::-webkit-scrollbar {
            display: none;
          }
        `}
      </style>

      <div
        className="scroll-container"
        style={{ background: "#FFFFFF" }}
      >
        {/* First set of columns */}
        {columns.map((column, colIndex) => (
          <div
            key={`column-${colIndex}`}
            className="flex-shrink-0 flex flex-col"
            style={{ gap: "16px", width: "300px" }}
          >
            {column.map((card, cardIndex) =>
              renderCard(card, colIndex, cardIndex, false),
            )}
          </div>
        ))}

        {/* Duplicate columns for infinite scroll */}
        {columns.map((column, colIndex) => (
          <div
            key={`column-duplicate-${colIndex}`}
            className="flex-shrink-0 flex flex-col"
            style={{ gap: "16px", width: "300px" }}
          >
            {column.map((card, cardIndex) =>
              renderCard(card, colIndex, cardIndex, true),
            )}
          </div>
        ))}
      </div>
    </div>
  );
}