import { Construction, type LucideIcon } from "lucide-react";

interface UnderConstructionProps {
  language: string;
  accentColor?: string;
  icon?: LucideIcon;
}

export function UnderConstruction({ language, accentColor = "#FB8C00", icon: Icon }: UnderConstructionProps) {
  const IconComponent = Icon || Construction;
  return (
    <div className="text-center py-16">
      <IconComponent size={56} style={{ color: accentColor, margin: "0 auto 16px", opacity: 0.25 }} />
      <p className="text-base" style={{ color: "#9CA3AF" }}>
        {language === "sr"
          ? "U pripremi — uskoro će biti dostupno!"
          : "Under construction — coming soon!"}
      </p>
    </div>
  );
}
