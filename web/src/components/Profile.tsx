import { useState } from "react";
import type { Profile as ProfileData, ProfileUpdate } from "../lib/api";
import { usePrefs } from "../lib/prefs";
import { LanguageSelect } from "./LanguageSelect";
import { ActivityHeatmap } from "./ActivityHeatmap";

export function Profile({
  profile,
  onUpdate,
}: {
  profile: ProfileData;
  onUpdate: (update: ProfileUpdate) => void;
}) {
  const { t, uiLang, setUiLang } = usePrefs();
  const [goal, setGoal] = useState(profile.dailyGoal);

  const goalMet = profile.todayCount >= profile.dailyGoal;

  function commitGoal(next: number) {
    const clamped = Math.max(1, Math.min(500, next));
    setGoal(clamped);
    if (clamped !== profile.dailyGoal) onUpdate({ dailyGoal: clamped });
  }

  return (
    <div className="flex h-full flex-col gap-5 overflow-y-auto pb-8">
      {/* Streak + today's progress */}
      <div className="rounded-2xl bg-mint-fill p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-3xl font-bold text-ink">🔥 {profile.streak}</p>
            <p className="text-sm text-muted">{t("dayStreak")}</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-semibold text-ink">
              {profile.todayCount}
              <span className="text-base text-muted">/{profile.dailyGoal}</span>
            </p>
            <p className="text-sm text-muted">{t("today")}</p>
          </div>
        </div>
        {goalMet && <p className="mt-3 text-center text-sm font-medium text-emerald-500">{t("goalMet")}</p>}
      </div>

      {/* Activity heatmap */}
      <div className="rounded-2xl bg-sky-fill p-5">
        <p className="mb-3 text-sm font-medium text-muted">{t("activityTitle")}</p>
        <ActivityHeatmap activity={profile.activity} goal={profile.dailyGoal} />
      </div>

      {/* Daily goal stepper */}
      <div className="flex items-center justify-between rounded-2xl bg-lilac-fill px-4 py-3">
        <span className="text-sm text-ink">{t("dailyGoal")}</span>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => commitGoal(goal - 1)}
            className="h-8 w-8 rounded-full bg-surface text-lg font-semibold text-ink"
          >
            −
          </button>
          <span className="w-8 text-center text-lg font-semibold text-ink">{goal}</span>
          <button
            type="button"
            onClick={() => commitGoal(goal + 1)}
            className="h-8 w-8 rounded-full bg-surface text-lg font-semibold text-ink"
          >
            +
          </button>
        </div>
      </div>

      {/* Languages */}
      <div className="flex flex-col gap-2">
        <LanguageSelect
          label={t("interfaceLanguage")}
          value={uiLang}
          onChange={(code) => {
            setUiLang(code);
            onUpdate({ interfaceLanguage: code });
          }}
        />
        <LanguageSelect
          label={t("iLearn")}
          value={profile.learningLanguage}
          onChange={(code) => onUpdate({ learningLanguage: code })}
        />
        <LanguageSelect
          label={t("translateTo")}
          value={profile.translationLanguage}
          onChange={(code) => onUpdate({ translationLanguage: code })}
        />
      </div>
    </div>
  );
}
