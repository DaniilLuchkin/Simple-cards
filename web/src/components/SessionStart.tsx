import { useState } from "react";
import type { Profile } from "../lib/api";
import { usePrefs } from "../lib/prefs";
import { cardsPerMinute, formatDuration } from "../lib/format";
import type { TimedBest } from "../lib/format";
import { QuestList } from "./QuestList";

// Timed-round length: 30s … 5min, in 15s steps.
const MIN_SECONDS = 30;
const MAX_SECONDS = 300;
const STEP_SECONDS = 15;

// The Review tab's lobby: what's waiting, today's quests, and the big Play
// button that starts a round. Having an explicit start makes a session feel
// like a round in a game rather than an endless list.
export function SessionStart({
  profile,
  dueCount,
  sessionSize,
  timedSeconds,
  timedBest,
  onPlay,
  onPlayTimed,
  onPractice,
}: {
  profile: Profile | null;
  dueCount: number;
  sessionSize: number;
  /** Last chosen timed length (persisted by the caller). */
  timedSeconds: number;
  /** Best run so far, scored by pace so any duration is comparable. */
  timedBest: TimedBest | null;
  onPlay: () => void;
  onPlayTimed: (seconds: number) => void;
  onPractice: () => void;
}) {
  const { t } = usePrefs();
  const goal = profile?.dailyGoal ?? 10;
  const done = profile?.todayCount ?? 0;
  const pct = Math.min(100, Math.round((done / goal) * 100));

  // Tapping the timed button opens the length picker rather than starting
  // straight away, so the duration is always a deliberate choice.
  const [picking, setPicking] = useState(false);
  const [seconds, setSeconds] = useState(timedSeconds);
  // One record for every length: pace makes the runs comparable.
  const bestPace = timedBest ? cardsPerMinute(timedBest.count, timedBest.seconds) : 0;
  const bestLabel = `${t("record")}: ${bestPace}${t("perMinuteShort")}`;

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
          <>
            <button
              type="button"
              onClick={onPlay}
              className="rounded-2xl border-2 border-black bg-mint px-4 py-4 text-lg font-bold text-ink shadow-toon"
            >
              ▶ {t("play")} · {sessionSize}
            </button>
            {/* Two jobs, two buttons: play now with the remembered length, or
                open the picker to change it. */}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => onPlayTimed(seconds)}
                className="flex-1 rounded-2xl border-2 border-black bg-butter px-4 py-3 text-base font-bold text-ink shadow-toon-sm"
              >
                ⏱ {t("playTimed")} · {formatDuration(seconds, t("timedLeft"))}
              </button>
              <button
                type="button"
                onClick={() => setPicking((v) => !v)}
                aria-expanded={picking}
                aria-label={t("timedLength")}
                className={`w-12 shrink-0 rounded-2xl border-2 border-black text-lg shadow-toon-sm ${
                  picking ? "bg-sky" : "bg-white"
                }`}
              >
                ⚙
              </button>
            </div>

            {bestPace > 0 && <p className="px-1 text-[11px] text-muted">{bestLabel}</p>}

            {picking && (
              <div className="flex flex-col gap-2 rounded-2xl border-2 border-black bg-surface p-4 shadow-toon-sm">
                <div className="flex items-baseline justify-between">
                  <span className="text-sm font-semibold text-ink">{t("timedLength")}</span>
                  <span className="text-lg font-bold tabular-nums text-ink">
                    {formatDuration(seconds, t("timedLeft"))}
                  </span>
                </div>
                <input
                  type="range"
                  min={MIN_SECONDS}
                  max={MAX_SECONDS}
                  step={STEP_SECONDS}
                  value={seconds}
                  onChange={(e) => setSeconds(Number(e.target.value))}
                  aria-label={t("timedLength")}
                  className="w-full accent-black"
                />
                <div className="flex justify-between text-[11px] text-muted">
                  <span>{formatDuration(MIN_SECONDS, t("timedLeft"))}</span>
                  <span>{formatDuration(MAX_SECONDS, t("timedLeft"))}</span>
                </div>
              </div>
            )}
          </>
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
