import { usePrefs } from "../lib/prefs";

export type Tab = "review" | "library" | "profile";

export function TabBar({ tab, onChange }: { tab: Tab; onChange: (tab: Tab) => void }) {
  const { t, theme, toggleTheme } = usePrefs();
  const items = [
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
    <div className="flex items-center gap-1 overflow-x-auto py-2">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => onChange(item.id)}
          className={`shrink-0 rounded-full px-2.5 py-1.5 text-sm font-medium transition ${
            tab === item.id ? "bg-sky/50 text-ink shadow-soft dark:bg-sky/25" : "bg-transparent text-muted"
          }`}
        >
          {item.label}
        </button>
      ))}
      <button
        type="button"
        onClick={toggleTheme}
        aria-label="Toggle theme"
        className="ml-auto flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-sky/40 text-sm dark:bg-sky/20"
      >
        {theme === "dark" ? "☀️" : "🌙"}
      </button>
    </div>
  );
}
