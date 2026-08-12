import { usePrefs } from "../lib/prefs";

// Real-world vocabulary milestones (approximate word counts). Shown optionally,
// since not everyone starts from zero.
const MILESTONES = [
  { key: "msCafe", words: 300 },
  { key: "msTalk", words: 1000 },
  { key: "msFluent", words: 3000 },
  { key: "msBooks", words: 5000 },
  { key: "msWork", words: 8000 },
] as const;

// Words learned so far + progress toward the next real-world milestone.
export function LearnedProgress({
  learned,
  showMilestones,
}: {
  learned: number;
  showMilestones: boolean;
}) {
  const { t } = usePrefs();
  const next = MILESTONES.find((m) => m.words > learned);

  return (
    <div className="rounded-2xl border-2 border-black bg-surface p-5 shadow-toon">
      <div className="flex items-baseline justify-between">
        <p className="text-3xl font-bold text-ink">📚 {learned}</p>
        <p className="text-sm text-muted">{t("wordsLearned")}</p>
      </div>

      {showMilestones && (
        <div className="mt-4 flex flex-col gap-2.5">
          {MILESTONES.map((m) => {
            const reached = learned >= m.words;
            const isNext = m === next;
            const pct = Math.min(100, Math.round((learned / m.words) * 100));
            return (
              <div key={m.key} className="flex flex-col gap-1">
                <div className="flex items-center justify-between text-sm">
                  <span className={reached ? "font-semibold text-ink" : "text-muted"}>
                    {reached ? "✅" : isNext ? "🎯" : "🔒"} {t(m.key)}
                  </span>
                  <span className={`text-xs ${reached ? "text-emerald-600" : "text-muted"}`}>
                    {reached ? t("reached") : `${learned}/${m.words}`}
                  </span>
                </div>
                {isNext && (
                  <div className="h-2 overflow-hidden rounded-full border-2 border-black bg-white">
                    <div className="h-full bg-mint" style={{ width: `${pct}%` }} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
