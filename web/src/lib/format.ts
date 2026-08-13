// Small display helpers shared by the session lobby and summary.

/** 45 -> "45s", 90 -> "1:30" — short values read better as plain seconds. */
export function formatDuration(seconds: number, secondsLabel: string): string {
  if (seconds < 60) return `${seconds}${secondsLabel}`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/**
 * Cards per minute, the pace a timed run is scored by. Normalising by time is
 * what makes runs of different lengths comparable - a raw count never is.
 * Kept to one decimal, with a trailing ".0" trimmed (15, 3.3).
 */
export function cardsPerMinute(count: number, seconds: number): number {
  if (seconds <= 0) return 0;
  return Math.round((count / seconds) * 60 * 10) / 10;
}

/** The best timed run so far, compared by pace rather than raw count. */
export type TimedBest = { count: number; seconds: number };

export function isFasterThan(run: TimedBest, best: TimedBest | null): boolean {
  if (!best) return run.count > 0;
  return cardsPerMinute(run.count, run.seconds) > cardsPerMinute(best.count, best.seconds);
}
