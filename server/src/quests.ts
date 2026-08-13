// Daily quests are DERIVED from the user's ReviewDay row - there is no quest
// table. Three are picked per day from a fixed pool, deterministically from the
// date, so they vary day to day but never change within a day.

export type QuestId = "session" | "goal" | "combo" | "learn" | "twoSessions" | "half";

export type Quest = {
  id: QuestId;
  /** Progress so far, capped at target. */
  progress: number;
  target: number;
  done: boolean;
};

// The per-day counters a quest can be measured against.
export type DayStats = {
  count: number;
  sessions: number;
  bestCombo: number;
  newLearned: number;
};

type QuestSpec = {
  id: QuestId;
  /** Target may depend on the user's daily goal. */
  target: (dailyGoal: number) => number;
  progress: (stats: DayStats) => number;
};

const POOL: QuestSpec[] = [
  { id: "session", target: () => 1, progress: (s) => s.sessions },
  { id: "goal", target: (goal) => goal, progress: (s) => s.count },
  { id: "combo", target: () => 5, progress: (s) => s.bestCombo },
  { id: "learn", target: () => 2, progress: (s) => s.newLearned },
  { id: "twoSessions", target: () => 2, progress: (s) => s.sessions },
  { id: "half", target: (goal) => Math.max(1, Math.ceil(goal / 2)), progress: (s) => s.count },
];

// "Complete a session" is always offered - it is the quest that teaches the core
// loop. The other two rotate through the pool by day so the set feels fresh.
const ALWAYS: QuestId = "session";
const ROTATING = POOL.filter((q) => q.id !== ALWAYS);

// Day number since the epoch, used as the rotation index. dayKey is "YYYY-MM-DD"
// so this stays stable for the whole local day.
function rotationIndex(dayKey: string): number {
  return Math.floor(Date.parse(`${dayKey}T00:00:00Z`) / 86_400_000);
}

export function dailyQuests(dayKey: string, dailyGoal: number, stats: DayStats): Quest[] {
  const i = rotationIndex(dayKey);
  const picked = [
    POOL.find((q) => q.id === ALWAYS)!,
    ROTATING[i % ROTATING.length],
    ROTATING[(i + 1 + (i % 2)) % ROTATING.length],
  ];

  // The offsets above can collide; de-dupe while keeping the order stable.
  const unique: QuestSpec[] = [];
  for (const spec of picked) {
    if (!unique.some((u) => u.id === spec.id)) unique.push(spec);
  }
  for (const spec of ROTATING) {
    if (unique.length >= 3) break;
    if (!unique.some((u) => u.id === spec.id)) unique.push(spec);
  }

  return unique.slice(0, 3).map((spec) => {
    const target = spec.target(dailyGoal);
    const raw = spec.progress(stats);
    const progress = Math.min(raw, target);
    return { id: spec.id, progress, target, done: raw >= target };
  });
}

export function allQuestsDone(quests: Quest[]): boolean {
  return quests.length > 0 && quests.every((q) => q.done);
}
