// 4-grade SM-2 scheduler, mirroring web/src/lib/srs.ts but operating on the
// Card columns (easeFactor == ease, repetitions == reps, interval in days).

export type Grade = "again" | "hard" | "good" | "easy";

type SchedInput = { easeFactor: number; interval: number; repetitions: number; lapses: number };
type SchedResult = SchedInput & { dueAt: Date };

const MIN_EASE = 1.3;
const RELEARN_MINUTES = 10;

export function gradeSchedule(state: SchedInput, grade: Grade, now: Date = new Date()): SchedResult {
  let easeFactor = state.easeFactor || 2.5;
  const prevInterval = state.interval || 0;
  let repetitions = state.repetitions || 0;
  let lapses = state.lapses || 0;
  let interval: number;

  if (grade === "again") {
    easeFactor = Math.max(MIN_EASE, easeFactor - 0.2);
    lapses += 1;
    repetitions = 0;
    interval = 0;
  } else {
    if (grade === "hard") easeFactor = Math.max(MIN_EASE, easeFactor - 0.15);
    if (grade === "easy") easeFactor = easeFactor + 0.15;

    if (repetitions === 0) {
      interval = grade === "hard" ? 1 : grade === "good" ? 2 : 4;
    } else {
      const base = Math.max(1, prevInterval);
      if (grade === "hard") interval = Math.max(prevInterval + 1, Math.round(base * 1.2));
      else if (grade === "good") interval = Math.round(base * easeFactor);
      else interval = Math.round(base * easeFactor * 1.3);
    }
    repetitions += 1;
  }

  const dueAt =
    grade === "again"
      ? new Date(now.getTime() + RELEARN_MINUTES * 60_000)
      : (() => {
          const d = new Date(now);
          d.setDate(d.getDate() + interval);
          return d;
        })();

  return { easeFactor: Math.round(easeFactor * 100) / 100, interval, repetitions, lapses, dueAt };
}
