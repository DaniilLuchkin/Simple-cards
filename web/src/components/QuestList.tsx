import type { Quest, QuestId } from "../lib/api";
import { usePrefs } from "../lib/prefs";

const QUEST_LABEL: Record<QuestId, "qSession" | "qGoal" | "qCombo" | "qLearn" | "qTwoSessions" | "qHalf"> = {
  session: "qSession",
  goal: "qGoal",
  combo: "qCombo",
  learn: "qLearn",
  twoSessions: "qTwoSessions",
  half: "qHalf",
};

// Today's three quests with progress bars. Labels take the target as {n}.
export function QuestList({ quests }: { quests: Quest[] }) {
  const { t } = usePrefs();
  if (!quests.length) return null;

  return (
    <div className="flex flex-col gap-2.5">
      {quests.map((q) => {
        const pct = Math.min(100, Math.round((q.progress / q.target) * 100));
        return (
          <div key={q.id} className="flex flex-col gap-1">
            <div className="flex items-center justify-between gap-2 text-sm">
              <span className={q.done ? "font-semibold text-ink" : "text-muted"}>
                {q.done ? "✅" : "◻️"} {t(QUEST_LABEL[q.id]).replace("{n}", String(q.target))}
              </span>
              <span className={`shrink-0 text-xs ${q.done ? "text-emerald-600" : "text-muted"}`}>
                {q.progress}/{q.target}
              </span>
            </div>
            {!q.done && (
              <div className="h-2 overflow-hidden rounded-full border-2 border-black bg-white">
                <div className="h-full bg-mint transition-all" style={{ width: `${pct}%` }} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
