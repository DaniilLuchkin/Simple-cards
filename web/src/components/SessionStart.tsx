import type { Profile } from "../lib/api";
import { usePrefs } from "../lib/prefs";
import { QuestList } from "./QuestList";

// The Review tab's lobby: what's waiting, today's quests, and the big Play
// button that starts a round. Having an explicit start makes a session feel
// like a round in a game rather than an endless list.
export function SessionStart({
  profile,
  dueCount,
  sessionSize,
  onPlay,
  onPractice,
}: {
  profile: Profile | null;
  dueCount: number;
  sessionSize: number;
  onPlay: () => void;
  onPractice: () => void;
}) {
  const { t } = usePrefs();
  const goal = profile?.dailyGoal ?? 10;
  const done = profile?.todayCount ?? 0;
  const pct = Math.min(100, Math.round((done / goal) * 100));

  return (
    <div className="-mx-2 flex h-full flex-col gap-4 overflow-y-auto px-2 pb-6 pt-1">
      {/* Streak + today's ring */}
      <div className="rounded-2xl border-2 border-black bg-surface p-5 shadow-toon">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-3xl font-bold text-ink">🔥 {profile?.streak ?? 0}</p>
            <p className="text-sm text-muted">{t("dayStreak")}</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-semibold text-ink">
              {done}
              <span className="text-base text-muted">/{goal}</span>
            </p>
            <p className="text-sm text-muted">{t("today")}</p>
          </div>
        </div>
        <div className="mt-3 h-2.5 overflow-hidden rounded-full border-2 border-black bg-white">
          <div className="h-full bg-mint transition-all" style={{ width: `${pct}%` }} />
        </div>
        {(profile?.streakFreezes ?? 0) > 0 && (
          <p className="mt-2 text-xs text-muted">
            🧊 {t("freezes")}: {profile?.streakFreezes}
          </p>
        )}
      </div>

      {/* Today's quests */}
      {profile?.quests?.length ? (
        <div className="rounded-2xl border-2 border-black bg-surface p-5 shadow-toon">
          <p className="mb-3 text-sm font-semibold text-muted">{t("questsTitle")}</p>
          <QuestList quests={profile.quests} />
          <p className="mt-3 text-xs text-muted">{t("questsReward")}</p>
        </div>
      ) : null}

      {/* Play */}
      <div className="mt-auto flex flex-col gap-2">
        {dueCount > 0 ? (
          <button
            type="button"
            onClick={onPlay}
            className="rounded-2xl border-2 border-black bg-mint px-4 py-4 text-lg font-bold text-ink shadow-toon"
          >
            ▶ {t("play")} · {sessionSize}
          </button>
        ) : (
          <div className="rounded-2xl border-2 border-black bg-surface p-5 text-center shadow-toon">
            <p className="text-2xl">🎉</p>
            <p className="mt-1 text-base font-semibold text-ink">{t("emptyTitle")}</p>
            <p className="mt-1 text-sm text-muted">{t("emptyHint")}</p>
          </div>
        )}
        <button
          type="button"
          onClick={onPractice}
          className="rounded-2xl border-2 border-black bg-white px-4 py-2.5 text-sm font-semibold text-ink shadow-toon-sm"
        >
          📚 {t("studyMore")}
        </button>
      </div>
    </div>
  );
}
