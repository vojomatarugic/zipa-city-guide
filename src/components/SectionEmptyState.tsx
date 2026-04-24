import { Construction, type LucideIcon } from "lucide-react";

interface SectionEmptyStateProps {
  message: string;
  icon?: LucideIcon;
  accentColor?: string;
  minHeight?: number;
  className?: string;
  backgroundTint?: string;
}

export function SectionEmptyState({
  message,
  icon: Icon = Construction,
  accentColor = "#9CA3AF",
  minHeight = 320,
  className = "",
  backgroundTint,
}: SectionEmptyStateProps) {
  const finalMessage =
    message.trim() === "Trenutno nema sadržaja u ovoj sekciji." ||
    message.trim() === "Trenutno nema sadržaja u ovoj sekciji za izabrani grad"
      ? "Trenutno nema događaja za izabrani grad"
      : message;

  return (
    <div
      className={`w-full flex items-center justify-center px-4 ${className}`.trim()}
      style={{ minHeight, background: backgroundTint }}
    >
      <div className="flex flex-col items-center text-center gap-5 max-w-[520px]">
        <Icon size={90} style={{ color: accentColor, opacity: 0.28 }} />
        <p
          className="text-[24px] font-semibold leading-6"
          style={{ color: "#6B7280" }}
        >
          {finalMessage}
        </p>
      </div>
    </div>
  );
}
