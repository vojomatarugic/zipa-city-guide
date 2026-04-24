/**
 * Reusable Event Card component for all event listing pages.
 * Renders an event from the database with consistent styling.
 */
import React from "react";
import { Link } from "react-router";
import { Heart, MapPin, Calendar, Clock3 } from "lucide-react";
import { Badge } from "./ui/badge";
import { Item } from "../utils/dataService";
import * as eventService from "../utils/eventService";
import { getLocalizedEventCategory } from "../config/eventCategories";
import { getTopLevelPageCategory } from "../utils/eventPageCategory";
import { getBadgeTextColorForPageSlug } from "../utils/categoryThemes";

interface EventCardProps {
  event: Item;
  language: string;
  accentColor: string;
  imageHeight?: string;
  interestCount?: number;
  showCity?: boolean;
  showVenue?: boolean;
  showDate?: boolean;
  showTime?: boolean;
  metadataOrder?: Array<"city" | "venue" | "date" | "time">;
  showEventCity?: boolean;
}

export function EventCard({
  event,
  language,
  accentColor,
  imageHeight = "300px",
  interestCount,
  showCity,
  showVenue = true,
  showDate = true,
  showTime = true,
  metadataOrder = ["venue", "date", "time"],
  showEventCity = false,
}: EventCardProps) {
  const locale: "sr" | "en" = language === "en" ? "en" : "sr";
  const title = language === "sr" ? event.title : (event.title_en || event.title);
  const slots = eventService.getEventScheduleSlots(event);
  const firstSlot = slots[0];
  const dateLabel = firstSlot ? eventService.formatEventDate(firstSlot.start_at, locale) : "";
  const timeLabel = firstSlot ? eventService.formatEventTime(firstSlot.start_at, firstSlot.end_at, locale) : "";
  const extraSlotCount = slots.length > 1 ? slots.length - 1 : 0;
  const venue = String(
    event.venue_name ||
      (event as Item & { location?: string }).location ||
      event.address ||
      "",
  ).trim();
  const eventCity = String(event.city || "").trim();
  const categoryLabel = event.category ? getLocalizedEventCategory(event.category, language) : "";
  const typeBadgeLabel =
    (event.event_type || "").trim() !== ""
      ? eventService.translateEventType(event.event_type || "", locale)
      : categoryLabel;
  const categoryBadgeTextColor = getBadgeTextColorForPageSlug(getTopLevelPageCategory(event));
  const shouldShowCity = showCity ?? showEventCity;
  const metadataValues: Record<"city" | "venue" | "date" | "time", string> = {
    city: eventCity,
    venue,
    date: dateLabel,
    time: timeLabel,
  };
  const metadataVisibility: Record<"city" | "venue" | "date" | "time", boolean> = {
    city: shouldShowCity,
    venue: showVenue,
    date: showDate,
    time: showTime,
  };
  const metadataIcons: Record<"city" | "venue" | "date" | "time", React.ReactNode> = {
    city: <MapPin size={14} className="shrink-0" style={{ color: "#6B7280" }} />,
    venue: <MapPin size={14} className="shrink-0" style={{ color: "#6B7280" }} />,
    date: <Calendar size={14} className="shrink-0" style={{ color: "#6B7280" }} />,
    time: <Clock3 size={14} className="shrink-0" style={{ color: "#6B7280" }} />,
  };
  const renderedMetadata = metadataOrder
    .filter((key) => metadataVisibility[key] && Boolean(metadataValues[key]))
    .map((key) => ({ key, value: metadataValues[key], icon: metadataIcons[key] }));

  return (
    <Link
      to={`/events/${event.id}`}
      className="cursor-pointer hover:scale-[1.02] transition-all duration-300 block"
      style={{ textDecoration: "none" }}
    >
      <img
        src={event.image || "https://images.unsplash.com/photo-1540039155733-5bb30b53aa14?w=600"}
        alt={title}
        className="w-full object-cover rounded-md"
        style={{ height: imageHeight }}
      />

      <div className="p-4 space-y-1">
        {typeBadgeLabel ? (
          <Badge
            className="rounded border-0 px-2 py-1 text-xs font-medium bg-[#F3F4F6]"
            style={{ color: categoryBadgeTextColor || "#6B7280" }}
          >
            {typeBadgeLabel}
          </Badge>
        ) : null}
        <h3 className="text-base font-semibold" style={{ color: "#1a1a1a" }}>
          {title}
        </h3>

        {renderedMetadata.length > 0 ? (
          <div className="space-y-1.5">
            {renderedMetadata.map((item) => (
              <div key={item.key} className="flex items-center gap-2 min-w-0">
                {item.icon}
                <p className="text-sm truncate" style={{ color: "#6B7280" }}>
                  {item.value}
                  {item.key === "time" && extraSlotCount > 0 ? (
                    <span className="whitespace-nowrap"> (+{extraSlotCount})</span>
                  ) : null}
                </p>
              </div>
            ))}
          </div>
        ) : null}

        {(interestCount ?? 0) > 0 && (
          <div className="flex items-center gap-1.5 pt-1">
            <Heart size={12} style={{ color: accentColor }} />
            <span className="text-xs" style={{ color: "#9CA3AF" }}>
              {interestCount} {language === "sr" ? "zainteresovano" : "interested"}
            </span>
          </div>
        )}
      </div>
    </Link>
  );
}

/**
 * Loading skeleton for event cards
 */
export function EventCardSkeleton({ count = 4, imageHeight = "300px" }: { count?: number; imageHeight?: string }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="animate-pulse">
          <div className="rounded-md" style={{ height: imageHeight, background: "#E5E7EB" }} />
          <div className="p-4 space-y-2">
            <div className="h-5 w-3/4 rounded" style={{ background: "#E5E7EB" }} />
            <div className="h-4 w-1/2 rounded" style={{ background: "#E5E7EB" }} />
            <div className="h-4 w-1/4 rounded" style={{ background: "#E5E7EB" }} />
            <div className="h-4 w-2/3 rounded" style={{ background: "#E5E7EB" }} />
          </div>
        </div>
      ))}
    </>
  );
}
