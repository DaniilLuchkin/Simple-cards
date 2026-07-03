import { usePrefs } from "../lib/prefs";

export type Tab = "review" | "library" | "profile";

export function TabBar({ tab, onChange }: { tab: Tab; onChange: (tab: Tab) => void }) {
  const { t } = usePrefs();
  const items = [
    { id: "review", label: t("tabReview") },
    { id: "library", label: t("tabLibrary") },
    { id: "profile", label: t("tabProfile") },
  ] as const;

  return (
    <div className="flex justify-center gap-2 py-3">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => onChange(item.id)}
          className={`rounded-full px-4 py-2 text-sm font-medium transition ${
            tab === item.id ? "bg-sky/50 text-ink shadow-soft dark:bg-sky/25" : "bg-transparent text-muted"
          }`}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
