/**
 * Reusable Event Card component for all event listing pages.
 * Renders an event from the database with consistent styling.
 */
import React from "react";
import { Link } from "react-router";
import { Heart } from "lucide-react";
import { Item } from "../utils/dataService";
import * as eventService from "../utils/eventService";

interface EventCardProps {
  event: Item;
  language: string;
  accentColor: string;
  imageHeight?: string;
  interestCount?: number;
}

export function EventCard({
  event,
  language,
  accentColor,
  imageHeight = "300px",
  interestCount,
}: EventCardProps) {
  const locale: "sr" | "en" = language === "en" ? "en" : "sr";
  const title = language === "sr" ? event.title : (event.title_en || event.title);
  const slots = eventService.getEventScheduleSlots(event);
  const firstSlot = slots[0];
  const dateLabel = firstSlot ? eventService.formatEventDate(firstSlot.start_at, locale) : "";
  const timeLabel = firstSlot ? eventService.formatEventTime(firstSlot.start_at, firstSlot.end_at, locale) : "";
  const extraSlotCount = slots.length > 1 ? slots.length - 1 : 0;
  const venue = event.venue_name || event.address || event.city || "";

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
        <h3 className="text-base font-semibold" style={{ color: "#1a1a1a" }}>
          {title}
        </h3>

        {dateLabel ? (
          <p className="text-sm" style={{ color: "#6B7280" }}>
            {dateLabel}
          </p>
        ) : null}

        {(timeLabel || extraSlotCount > 0) ? (
          <p className="text-sm" style={{ color: "#6B7280" }}>
            {timeLabel}
            {extraSlotCount > 0 ? (
              <span className="whitespace-nowrap">
                {timeLabel ? " " : ""}(+{extraSlotCount})
              </span>
            ) : null}
          </p>
        ) : null}

        {venue ? (
          <p className="text-sm" style={{ color: "#6B7280" }}>
            {venue}
          </p>
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
