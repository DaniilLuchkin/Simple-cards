import type { ReactNode } from "react";
import { usePrefs } from "../lib/prefs";

export type Tab = "translator" | "review" | "library" | "profile";

export function TabBar({
  tab,
  onChange,
  leading,
}: {
  tab: Tab;
  onChange: (tab: Tab) => void;
  leading?: ReactNode;
}) {
  const { t, theme, toggleTheme } = usePrefs();
  const items = [
    { id: "translator", label: t("tabTranslator") },
    { id: "review", label: t("tabReview") },
    { id: "library", label: t("tabLibrary") },
    { id: "profile", label: t("tabProfile") },
  ] as const;

  return (
    // Tabs + theme toggle on one row to save vertical space for the card.
    // Natural-width pills, theme button pushed to the end with ml-auto (no
    // absolute positioning, no nested scroll region - just plain flex flow).
    // If long labels (e.g. Russian/Ukrainian) ever don't fit a narrow phone,
    // the whole row scrolls horizontally instead of clipping or overlapping.
    <div className="-mx-4 flex items-center gap-1.5 overflow-x-auto px-4 py-2">
      {leading}
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => onChange(item.id)}
          className={`shrink-0 rounded-full border-2 px-2.5 py-1 text-sm font-semibold transition ${
            tab === item.id
              ? "border-black bg-sky text-ink shadow-toon-sm"
              : "border-transparent bg-transparent text-oncanvas"
          }`}
        >
          {item.label}
        </button>
      ))}
      <button
        type="button"
        onClick={toggleTheme}
        aria-label="Toggle theme"
        className="ml-auto flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-black bg-white text-sm shadow-toon-sm"
      >
        {theme === "dark" ? "☀️" : "🌙"}
      </button>
    </div>
  );
}
