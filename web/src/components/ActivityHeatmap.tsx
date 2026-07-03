const WEEKS = 18;

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

  return (
    <div className="flex justify-center gap-[3px] overflow-x-auto">
      {columns.map((col, c) => (
        <div key={c} className="flex flex-col gap-[3px]">
          {col.map(({ date, count }, r) => {
            const isToday = key(date) === todayKey;
            let cls = "bg-sky/20 dark:bg-white/5";
            if (count !== null && count > 0) {
              cls = count >= goal ? "bg-emerald-500" : "bg-emerald-400/40";
            }
            return (
              <div
                key={r}
                title={count === null ? "" : `${key(date)}: ${count}`}
                className={`h-3.5 w-3.5 rounded-[3px] ${count === null ? "opacity-0" : cls} ${
                  isToday ? "ring-2 ring-emerald-500/60" : ""
                }`}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}
