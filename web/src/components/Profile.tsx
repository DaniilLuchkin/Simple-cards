import { useState } from "react";
import type { Profile as ProfileData, ProfileUpdate } from "../lib/api";
import { usePrefs, PALETTES } from "../lib/prefs";
import type { Palette } from "../lib/prefs";
import { LanguageSelect } from "./LanguageSelect";
import { ActivityHeatmap } from "./ActivityHeatmap";

const PALETTE_LABEL: Record<Palette, "bgLavender" | "bgMint" | "bgSky"> = {
  lavender: "bgLavender",
  mint: "bgMint",
  sky: "bgSky",
};

export function Profile({
  profile,
  onUpdate,
}: {
  profile: ProfileData;
  onUpdate: (update: ProfileUpdate) => void;
}) {
  const { t, uiLang, setUiLang, palette, setPalette, theme, toggleTheme } = usePrefs();
  const [goal, setGoal] = useState(profile.dailyGoal);

  const goalMet = profile.todayCount >= profile.dailyGoal;

  function commitGoal(next: number) {
    const clamped = Math.max(1, Math.min(500, next));
    setGoal(clamped);
    if (clamped !== profile.dailyGoal) onUpdate({ dailyGoal: clamped });
  }

  return (
    <div className="-mx-2 flex h-full flex-col gap-5 overflow-y-auto px-2 pb-8 pt-1">
      {/* Streak + today's progress */}
      <div className="rounded-2xl border-2 border-black bg-surface p-5 shadow-toon">
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
        {goalMet && <p className="mt-3 text-center text-sm font-semibold text-emerald-600">{t("goalMet")}</p>}
      </div>

      {/* Activity heatmap */}
      <div className="rounded-2xl border-2 border-black bg-surface p-5 shadow-toon">
        <p className="mb-3 text-sm font-semibold text-muted">{t("activityTitle")}</p>
        <ActivityHeatmap activity={profile.activity} goal={profile.dailyGoal} />
      </div>

      {/* Daily goal stepper */}
      <div className="flex items-center justify-between rounded-2xl border-2 border-black bg-surface px-4 py-3 shadow-toon">
        <span className="text-sm text-ink">{t("dailyGoal")}</span>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => commitGoal(goal - 1)}
            className="h-8 w-8 rounded-full border-2 border-black bg-white text-lg font-semibold text-ink shadow-toon-sm"
          >
            −
          </button>
          <span className="w-8 text-center text-lg font-semibold text-ink">{goal}</span>
          <button
            type="button"
            onClick={() => commitGoal(goal + 1)}
            className="h-8 w-8 rounded-full border-2 border-black bg-white text-lg font-semibold text-ink shadow-toon-sm"
          >
            +
          </button>
        </div>
      </div>

      {/* Word of the day on/off */}
      <div className="flex items-center justify-between rounded-2xl border-2 border-black bg-surface px-4 py-3 shadow-toon">
        <span className="text-sm text-ink">{t("wordOfDay")}</span>
        <button
          type="button"
          role="switch"
          aria-checked={profile.wordOfDayEnabled}
          aria-label={t("wordOfDay")}
          onClick={() => onUpdate({ wordOfDayEnabled: !profile.wordOfDayEnabled })}
          className={`relative h-8 w-14 rounded-full border-2 border-black shadow-toon-sm transition-colors ${
            profile.wordOfDayEnabled ? "bg-mint" : "bg-white"
          }`}
        >
          <span
            className={`absolute top-1/2 h-5 w-5 -translate-y-1/2 rounded-full border-2 border-black bg-white transition-all ${
              profile.wordOfDayEnabled ? "left-[26px]" : "left-[2px]"
            }`}
          />
        </button>
      </div>

      {/* Light / dark theme */}
      <div className="rounded-2xl border-2 border-black bg-surface p-4 shadow-toon">
        <p className="mb-3 text-sm text-ink">{t("theme")}</p>
        <div className="flex gap-2">
          <button
            type="button"
            aria-pressed={theme === "light"}
            onClick={() => {
              if (theme !== "light") toggleTheme();
            }}
            className={`flex-1 rounded-xl border-2 border-black px-3 py-2 text-sm font-semibold text-ink shadow-toon-sm ${
              theme === "light" ? "bg-sky" : "bg-white"
            }`}
          >
            ☀️ {t("themeLight")}
          </button>
          <button
            type="button"
            aria-pressed={theme === "dark"}
            onClick={() => {
              if (theme !== "dark") toggleTheme();
            }}
            className={`flex-1 rounded-xl border-2 border-black px-3 py-2 text-sm font-semibold text-ink shadow-toon-sm ${
              theme === "dark" ? "bg-sky" : "bg-white"
            }`}
          >
            🌙 {t("themeDark")}
          </button>
        </div>
      </div>

      {/* Light-theme background color */}
      <div className="rounded-2xl border-2 border-black bg-surface p-4 shadow-toon">
        <p className="mb-3 text-sm text-ink">{t("bgColor")}</p>
        <div className="flex gap-3">
          {PALETTES.map((p) => {
            const active = p.id === palette;
            return (
              <button
                key={p.id}
                type="button"
                aria-label={t(PALETTE_LABEL[p.id])}
                aria-pressed={active}
                onClick={() => setPalette(p.id)}
                style={{ backgroundColor: p.hex }}
                className={`h-11 w-11 rounded-xl border-2 border-black transition ${
                  active ? "ring-2 ring-black ring-offset-2 ring-offset-surface" : ""
                }`}
              >
                {active && <span className="text-sm font-bold text-ink">✓</span>}
              </button>
            );
          })}
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
