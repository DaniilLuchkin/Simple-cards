export type Sm2State = {
  easeFactor: number;
  interval: number;
  repetitions: number;
};

export type Sm2Result = Sm2State & {
  dueAt: Date;
};

/**
 * Swipe right ("remembered") -> quality 4, swipe left ("forgot") -> quality 1.
 * Classic SuperMemo-2: https://super-memory.com/english/ol/sm2.htm
 */
export type ReviewQuality = "remembered" | "forgot";

const QUALITY_SCORE: Record<ReviewQuality, number> = {
  remembered: 4,
  forgot: 1,
};

export function sm2(state: Sm2State, quality: ReviewQuality, now: Date = new Date()): Sm2Result {
  const q = QUALITY_SCORE[quality];
  let { easeFactor, interval, repetitions } = state;

  if (q < 3) {
    repetitions = 0;
    interval = 1;
  } else {
    repetitions += 1;
    if (repetitions === 1) interval = 1;
    else if (repetitions === 2) interval = 6;
    else interval = Math.round(interval * easeFactor);
  }

  easeFactor = easeFactor + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02));
  if (easeFactor < 1.3) easeFactor = 1.3;

  const dueAt = new Date(now);
  dueAt.setDate(dueAt.getDate() + interval);

  return { easeFactor, interval, repetitions, dueAt };
}
