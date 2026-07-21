import type { ReactNode } from "react";
import { usePrefs } from "../lib/prefs";

export type Tab = "ai" | "translator" | "review" | "library" | "profile";

export function TabBar({
  tab,
  onChange,
  leading,
}: {
  tab: Tab;
  onChange: (tab: Tab) => void;
  leading?: ReactNode;
}) {
  const { t } = usePrefs();
  const items = [
    { id: "ai", label: t("tabAi") },
    { id: "translator", label: t("tabTranslator") },
    { id: "review", label: t("tabReview") },
    { id: "library", label: t("tabLibrary") },
    { id: "profile", label: t("tabProfile") },
  ] as const;

  return (
    // Leading camera button + natural-width tab pills on one compact row (the
    // theme toggle now lives in Profile). If long labels don't fit a narrow
    // phone it scrolls horizontally with the scrollbar hidden (no-scrollbar).
    <div className="no-scrollbar -mx-4 flex items-center gap-1 overflow-x-auto px-4 py-2">
      {leading}
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => onChange(item.id)}
          className={`shrink-0 rounded-full border-2 px-2 py-1 text-[13px] font-semibold transition ${
            tab === item.id
              ? "border-black bg-sky text-ink shadow-toon-sm"
              : "border-transparent bg-transparent text-oncanvas"
          }`}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
