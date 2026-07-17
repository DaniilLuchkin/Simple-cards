// Spaced-repetition scheduler. FSRS-free: an Anki-style 4-grade SM-2 variant.
// Kept entirely out of the card component so the UI just renders whatever
// intervals this returns (the grade buttons show real "next due" values).

export type SrsState = {
  // ISO timestamp of the next review.
  due: string;
  // Current inter-repetition interval in days (0 means "still learning",
  // shown as "<10 min").
  interval: number;
  ease: number;
  reps: number;
  lapses: number;
};

export type Grade = "again" | "hard" | "good" | "easy";
export const GRADES: Grade[] = ["again", "hard", "good", "easy"];

const MIN_EASE = 1.3;
const RELEARN_MINUTES = 10;

function addDays(now: Date, days: number): Date {
  const d = new Date(now);
  d.setDate(d.getDate() + days);
  return d;
}

function addMinutes(now: Date, minutes: number): Date {
  return new Date(now.getTime() + minutes * 60_000);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function initialSrsState(now: Date = new Date()): SrsState {
  return { due: now.toISOString(), interval: 0, ease: 2.5, reps: 0, lapses: 0 };
}

/**
 * Applies a grade and returns the next SRS state. Pure — never mutates input.
 */
export function schedule(state: SrsState, grade: Grade, now: Date = new Date()): SrsState {
  let ease = state.ease || 2.5;
  const prevInterval = state.interval || 0;
  let reps = state.reps || 0;
  let lapses = state.lapses || 0;
  let interval: number;

  if (grade === "again") {
    ease = Math.max(MIN_EASE, ease - 0.2);
    lapses += 1;
    reps = 0;
    interval = 0; // back to (re)learning
  } else {
    if (grade === "hard") ease = Math.max(MIN_EASE, ease - 0.15);
    if (grade === "easy") ease = ease + 0.15;

    if (reps === 0) {
      // First graduation from learning.
      interval = grade === "hard" ? 1 : grade === "good" ? 2 : 4;
    } else {
      const base = Math.max(1, prevInterval);
      if (grade === "hard") interval = Math.max(prevInterval + 1, Math.round(base * 1.2));
      else if (grade === "good") interval = Math.round(base * ease);
      else interval = Math.round(base * ease * 1.3);
    }
    reps += 1;
  }

  const due = grade === "again" ? addMinutes(now, RELEARN_MINUTES) : addDays(now, interval);
  return { due: due.toISOString(), interval, ease: round2(ease), reps, lapses };
}

/** The interval (in days; 0 = "learning") each grade would produce right now. */
export function previewIntervals(state: SrsState, now: Date = new Date()): Record<Grade, number> {
  return GRADES.reduce(
    (acc, grade) => {
      acc[grade] = schedule(state, grade, now).interval;
      return acc;
    },
    {} as Record<Grade, number>
  );
}

export type IntervalUnits = { lt10m: string; day: string; month: string; year: string };

/** Compact human interval, e.g. "<10м", "1 д", "3 мес", "2 г". */
export function formatInterval(days: number, units: IntervalUnits): string {
  if (days <= 0) return units.lt10m;
  if (days < 30) return `${days} ${units.day}`;
  if (days < 365) return `${Math.round(days / 30)} ${units.month}`;
  return `${Math.round((days / 365) * 10) / 10} ${units.year}`;
}
