export type Tab = "review" | "library";

export function TabBar({ tab, onChange }: { tab: Tab; onChange: (tab: Tab) => void }) {
  return (
    <div className="flex justify-center gap-2 py-3">
      {(
        [
          { id: "review", label: "Повторение" },
          { id: "library", label: "Мои карточки" },
        ] as const
      ).map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => onChange(t.id)}
          className={`rounded-full px-5 py-2 text-sm font-medium transition ${
            tab === t.id ? "bg-sky/50 text-ink shadow-soft" : "bg-transparent text-muted"
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
