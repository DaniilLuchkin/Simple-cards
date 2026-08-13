import { usePrefs } from "../lib/prefs";

// Plain word-count milestones - no labels, so they fit any learner regardless
// of where they started.
const MILESTONES = [100, 300, 1000, 3000, 5000, 8000];

// Words learned so far + progress toward the next milestone.
export function LearnedProgress({ learned }: { learned: number }) {
  const { t } = usePrefs();
  const next = MILESTONES.find((m) => m > learned) ?? null;
  const pct = next ? Math.min(100, Math.round((learned / next) * 100)) : 100;

  return (
    <div>
      <div className="flex items-baseline justify-between">
        <p className="text-3xl font-bold text-ink">📚 {learned}</p>
        <p className="text-sm text-muted">{t("wordsLearned")}</p>
      </div>

      <div className="mt-3 h-2.5 overflow-hidden rounded-full border-2 border-black bg-white">
        <div className="h-full bg-mint transition-all" style={{ width: `${pct}%` }} />
      </div>

      {/* All milestones fit one row on a narrow phone, so the ladder reads at
          a glance instead of wrapping. */}
      <div className="mt-2.5 flex flex-wrap gap-1">
        {MILESTONES.map((m) => {
          const reached = learned >= m;
          const isNext = m === next;
          return (
            <span
              key={m}
              className={`rounded-full border-2 px-2 py-0.5 text-[11px] font-semibold ${
                reached
                  ? "border-black bg-mint text-ink"
                  : isNext
                    ? "border-black bg-white text-ink"
                    : "border-black/25 bg-white text-muted"
              }`}
            >
              {m}
            </span>
          );
        })}
      </div>
    </div>
  );
}
