/**
 * Reusable Event Card component for all event listing pages.
 * Renders an event from the database with consistent styling.
 */
import React from "react";
import { Link } from "react-router";
import { Calendar, Clock, MapPin, Heart } from "lucide-react";
import { Item } from "../utils/dataService";
import * as eventService from "../utils/eventService";

interface EventCardProps {
  event: Item;
  language: string;
  accentColor: string;
  imageHeight?: string;
  interestCount?: number;
}

export function EventCard({ event, language, accentColor, imageHeight = "300px", interestCount }: EventCardProps) {
  const locale: "sr" | "en" = language === "en" ? "en" : "sr";
  const title = language === "sr" ? event.title : (event.title_en || event.title);
  const isFree = /^(free|besplatn|gratis)/i.test(event.price || '') || /^(free|besplatn|gratis)/i.test(event.price_en || '');
  const eventType = eventService.translateEventType(event.event_type || event.page_slug || '', locale);
  const dateLabel = event.start_at ? eventService.getRelativeDateLabel(event.start_at, locale) : '';
  const timeLabel = event.start_at ? eventService.formatEventTime(event.start_at, event.end_at) : '';
  const venue = event.venue_name || event.address || event.city || '';

  return (
    <Link
      to={`/events/${event.id}`}
      className="cursor-pointer hover:scale-[1.02] transition-all duration-300 block"
      style={{ textDecoration: "none" }}
    >
      {/* Image */}
      <img
        src={event.image || "https://images.unsplash.com/photo-1540039155733-5bb30b53aa14?w=600"}
        alt={title}
        className="w-full object-cover rounded-md"
        style={{ height: imageHeight }}
      />

      {/* Content */}
      <div className="p-4">
        {/* Category and Badge */}
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          {eventType && (
            <span
              className="text-xs font-medium px-2 py-1 rounded"
              style={{ background: "#F3F4F6", color: accentColor }}
            >
              {eventType}
            </span>
          )}
          {isFree && (
            <span
              className="text-xs font-medium px-2 py-1 rounded"
              style={{ background: "#F3F4F6", color: "#6B7280" }}
            >
              {language === "sr" ? "Besplatan ulaz" : "Free Entry"}
            </span>
          )}
        </div>

        {/* Title */}
        <h3
          className="text-base font-semibold mb-2"
          style={{ color: "#1a1a1a" }}
        >
          {title}
        </h3>

        {/* Date (row 1) + time (row 2) */}
        {(dateLabel || timeLabel) && (
          <div className="space-y-1 mb-1">
            {dateLabel && (
              <div className="flex items-center gap-2">
                <Calendar size={14} style={{ color: "#6B7280" }} />
                <span className="text-sm" style={{ color: "#6B7280" }}>
                  {dateLabel}
                </span>
              </div>
            )}
            {timeLabel && (
              <div className="flex items-center gap-2">
                <Clock size={14} style={{ color: "#6B7280" }} />
                <span className="text-sm" style={{ color: "#6B7280" }}>
                  {timeLabel}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Venue */}
        {venue && (
          <div className="flex items-center gap-2">
            <MapPin size={14} style={{ color: "#6B7280" }} />
            <span className="text-sm" style={{ color: "#6B7280" }}>
              {venue}
            </span>
          </div>
        )}

        {/* Interest count */}
        {(interestCount ?? 0) > 0 && (
          <div className="flex items-center gap-1.5 mt-1">
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
            <div className="h-4 w-16 rounded" style={{ background: "#E5E7EB" }} />
            <div className="h-5 w-3/4 rounded" style={{ background: "#E5E7EB" }} />
            <div className="h-4 w-1/2 rounded" style={{ background: "#E5E7EB" }} />
          </div>
        </div>
      ))}
    </>
  );
}
