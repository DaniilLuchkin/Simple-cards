import { usePrefs } from "../lib/prefs";
import type { Palette } from "../lib/prefs";

const WEEKS = 18;

// Heatmap fills follow the user's chosen palette (same hue, stronger so it
// reads on white): [goal met, studied below goal].
const HEATMAP: Record<Palette, { met: string; below: string }> = {
  lavender: { met: "#8b5cf6", below: "#c4b5fd" },
  mint: { met: "#10b981", below: "#6ee7b7" },
  sky: { met: "#3b82f6", below: "#93c5fd" },
};

function utcToday(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function key(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// GitHub-style contribution grid: columns = weeks (Mon-top .. Sun-bottom).
// A day is bright when the goal was met, dim when studied below goal.
export function ActivityHeatmap({
  activity,
  goal,
}: {
  activity: Record<string, number>;
  goal: number;
}) {
  const today = utcToday();
  const dowMon = (today.getUTCDay() + 6) % 7; // Mon=0 .. Sun=6
  const start = new Date(today);
  start.setUTCDate(start.getUTCDate() - dowMon - (WEEKS - 1) * 7);

  const columns: { date: Date; count: number | null }[][] = [];
  for (let c = 0; c < WEEKS; c++) {
    const col: { date: Date; count: number | null }[] = [];
    for (let r = 0; r < 7; r++) {
      const date = new Date(start);
      date.setUTCDate(start.getUTCDate() + c * 7 + r);
      col.push({ date, count: date > today ? null : activity[key(date)] ?? 0 });
    }
    columns.push(col);
  }

  const todayKey = key(today);
  const { palette } = usePrefs();
  const fill = HEATMAP[palette];

  return (
    <div className="flex justify-center gap-[3px]">
      {columns.map((col, c) => (
        <div key={c} className="flex flex-col gap-[3px]">
          {col.map(({ date, count }, r) => {
            const isToday = key(date) === todayKey;
            const studied = count !== null && count > 0;
            const bg = studied ? (count >= goal ? fill.met : fill.below) : undefined;
            return (
              <div
                key={r}
                title={count === null ? "" : `${key(date)}: ${count}`}
                style={bg ? { backgroundColor: bg } : undefined}
                className={`h-3 w-3 rounded-[3px] ${count === null ? "opacity-0" : studied ? "" : "bg-black/10"} ${
                  isToday ? "ring-2 ring-black" : ""
                }`}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}
