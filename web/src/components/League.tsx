import { useEffect, useState } from "react";
import type { LeagueEntry } from "../lib/api";
import { api } from "../lib/api";
import { usePrefs } from "../lib/prefs";

const MEDALS = ["🥇", "🥈", "🥉"];

// Weekly leaderboard across the friends you invited (and whoever invited you),
// ranked by cards reviewed this week. Loads on mount; stays quiet on failure.
export function League() {
  const { t } = usePrefs();
  const [entries, setEntries] = useState<LeagueEntry[] | null>(null);

  useEffect(() => {
    api
      .getLeague()
      .then((res) => setEntries(res.entries))
      .catch((err) => console.error("Failed to load league", err));
  }, []);

  if (!entries) return null;

  return (
    <div className="rounded-2xl border-2 border-black bg-surface p-5 shadow-toon">
      <p className="mb-3 text-sm font-semibold text-muted">{t("leagueTitle")}</p>

      {entries.length <= 1 ? (
        <p className="text-sm text-muted">{t("leagueEmpty")}</p>
      ) : (
        <div className="flex flex-col gap-2">
          {entries.map((e, i) => (
            <div
              key={`${e.name}-${i}`}
              className={`flex items-center gap-2 rounded-xl border-2 px-3 py-2 ${
                e.isMe ? "border-black bg-sky" : "border-black/20 bg-white"
              }`}
            >
              <span className="w-6 shrink-0 text-center text-sm">{MEDALS[i] ?? i + 1}</span>
              <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">
                {e.isMe ? t("leagueYou") : e.name}
              </span>
              <span className="shrink-0 text-sm text-muted">{e.count}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
