import { motion } from "framer-motion";
import type { Profile } from "../lib/api";
import { usePrefs } from "../lib/prefs";
import { cardsPerMinute } from "../lib/format";
import { Confetti } from "./Confetti";
import { QuestList } from "./QuestList";

// The payoff screen at the end of a round: what you did, how well, and what it
// moved. This is the "win state" the endless deck never had.
export function SessionSummary({
  reviewed,
  correct,
  bestCombo,
  timed,
  timedSeconds,
  record,
  profile,
  canPlayAgain,
  onPlayAgain,
  onDone,
}: {
  reviewed: number;
  correct: number;
  bestCombo: number;
  /** Timed round: the card count reads as a score, and a new best is called out. */
  timed: boolean;
  /** Length of the timed round, used to show the pace. */
  timedSeconds: number;
  record: boolean;
  profile: Profile | null;
  canPlayAgain: boolean;
  onPlayAgain: () => void;
  onDone: () => void;
}) {
  const { t } = usePrefs();
  const accuracy = reviewed > 0 ? Math.round((correct / reviewed) * 100) : 0;
  const goalMet = (profile?.todayCount ?? 0) >= (profile?.dailyGoal ?? 10);

  return (
    <div className="-mx-2 flex h-full flex-col gap-4 overflow-y-auto px-2 pb-6 pt-1">
      <div className="relative overflow-hidden rounded-2xl border-2 border-black bg-surface p-6 text-center shadow-toon">
        <Confetti />
        <motion.div
          initial={{ scale: 0.7, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 260, damping: 18 }}
        >
          <p className="text-4xl">{record ? "🏆" : goalMet ? "🏆" : "✨"}</p>
          <p className="mt-2 text-xl font-bold text-ink">
            {record ? t("newRecord") : goalMet ? t("goalMet") : t("roundDone")}
          </p>
        </motion.div>

        <div className="mt-5 grid grid-cols-3 gap-2">
          <Stat
            value={String(reviewed)}
            label={timed ? t("timedScore") : t("statCards")}
            note={timed ? `${cardsPerMinute(reviewed, timedSeconds)} ${t("perMinute")}` : undefined}
          />
          <Stat value={`${accuracy}%`} label={t("statAccuracy")} />
          <Stat value={`🔥${bestCombo}`} label={t("statCombo")} />
        </div>

        <p className="mt-4 text-sm text-muted">
          {t("streak")}: <span className="font-semibold text-ink">{profile?.streak ?? 0}</span> ·{" "}
          {t("today")}:{" "}
          <span className="font-semibold text-ink">
            {profile?.todayCount ?? 0}/{profile?.dailyGoal ?? 10}
          </span>
        </p>
      </div>

      {profile?.quests?.length ? (
        <div className="rounded-2xl border-2 border-black bg-surface p-5 shadow-toon">
          <p className="mb-3 text-sm font-semibold text-muted">{t("questsTitle")}</p>
          <QuestList quests={profile.quests} />
        </div>
      ) : null}

      <div className="mt-auto flex flex-col gap-2">
        {canPlayAgain && (
          <button
            type="button"
            onClick={onPlayAgain}
            className="rounded-2xl border-2 border-black bg-mint px-4 py-3.5 text-base font-bold text-ink shadow-toon"
          >
            ▶ {t("playAgain")}
          </button>
        )}
        <button
          type="button"
          onClick={onDone}
          className="rounded-2xl border-2 border-black bg-white px-4 py-2.5 text-sm font-semibold text-ink shadow-toon-sm"
        >
          {t("done")}
        </button>
      </div>
    </div>
  );
}

function Stat({ value, label, note }: { value: string; label: string; note?: string }) {
  return (
    <div className="rounded-xl border-2 border-black bg-white px-2 py-2">
      <p className="text-lg font-bold text-ink">{value}</p>
      <p className="text-[11px] text-muted">{label}</p>
      {note && <p className="text-[11px] font-semibold text-ink">{note}</p>}
    </div>
  );
}
