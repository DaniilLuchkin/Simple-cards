import type { Card } from "@prisma/client";
import { prisma } from "./db.js";
import {
  filledSentence,
  generateCard,
  generateCardFromImage,
  generateCardSet,
  generateGrammarSet,
  generateImage,
  regenerateCard,
} from "./llm.js";
import type { GeneratedCardFields, Levels } from "./llm.js";
import { languageNames } from "./languages.js";
import type { Languages } from "./languages.js";
import { absoluteImageUrl, saveImage } from "./storage.js";
import { referralLink } from "./botInfo.js";
import { allQuestsDone, dailyQuests } from "./quests.js";
import type { Quest } from "./quests.js";

// Maps generated fields onto the Card columns. `word`/`example` mirror
// `headword`/filled-sentence for the library preview and legacy compatibility.
function cardColumns(fields: GeneratedCardFields) {
  return {
    word: fields.headword,
    example: filledSentence(fields),
    sentence: fields.sentence,
    explanation: fields.explanation,
    translation: fields.translation,
    ipa: fields.ipa || null,
    pos: fields.pos || null,
    forms: fields.forms,
    collocations: fields.collocations,
  };
}

// Reconstructs generated-field shape from a stored card (for regeneration).
function cardToFields(card: Card): GeneratedCardFields {
  return {
    headword: card.word,
    ipa: card.ipa ?? "",
    pos: card.pos ?? "",
    forms: card.forms,
    sentence: card.sentence ?? card.example,
    explanation: card.explanation,
    translation: card.translation,
    collocations: card.collocations,
  };
}

export async function getOrCreateUser(input: {
  telegramId: bigint;
  username?: string;
  firstName?: string;
}) {
  return prisma.user.upsert({
    where: { telegramId: input.telegramId },
    update: { username: input.username, firstName: input.firstName },
    create: {
      telegramId: input.telegramId,
      username: input.username,
      firstName: input.firstName,
    },
  });
}

// Attributes `userId` to `referrerId` (from a ref deep link), but only once and
// never to self or a non-existent referrer. Safe to call on every /start.
export async function creditReferral(userId: string, referrerId: string) {
  if (userId === referrerId) return;
  const referrer = await prisma.user.findUnique({ where: { id: referrerId }, select: { id: true } });
  if (!referrer) return;
  await prisma.user.updateMany({
    where: { id: userId, referredById: null },
    data: { referredById: referrerId },
  });
}

async function userLanguages(userId: string): Promise<Languages> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { learningLanguage: true, translationLanguage: true },
  });
  return languageNames(user);
}

async function userLevels(userId: string): Promise<Levels> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { currentLevel: true, targetLevel: true },
  });
  return { current: user.currentLevel, target: user.targetLevel };
}

// A card counts as "learned" once its SRS interval reaches this many days - the
// standard "mature card" threshold.
export const LEARNED_INTERVAL_DAYS = 21;

// Every new card gets an illustration, whichever flow created it (bot chat,
// translator, word of the day, AI set). Best-effort: a failed image must never
// fail card creation, the card just shows without one.
async function imageForNewCard(fields: GeneratedCardFields): Promise<string | null> {
  try {
    return await generateCardImageFile({
      word: fields.headword,
      example: filledSentence(fields),
      explanation: fields.explanation,
    });
  } catch (err) {
    console.error("Card image generation failed", err);
    return null;
  }
}

export async function createCard(input: {
  userId: string;
  word: string;
  userExample?: string;
  imagePath?: string;
  /** Omitted by the bot, so its cards land in the general deck. */
  deckId?: string;
}) {
  const fields = await generateCard({
    word: input.word,
    userExample: input.userExample,
    // The LLM fetches the image itself, so it needs the full public URL.
    imageUrl: absoluteImageUrl(input.imagePath ?? null) ?? undefined,
    languages: await userLanguages(input.userId),
  });

  // The user's own photo wins; otherwise draw one for the word.
  const imagePath = input.imagePath ?? (await imageForNewCard(fields));

  return prisma.card.create({
    data: {
      userId: input.userId,
      ...cardColumns(fields),
      imageUrl: imagePath,
      deckId: input.deckId ?? null,
    },
  });
}

// For flows where the fields were already generated (e.g. accepting the word
// of the day) - no card-text LLM round-trip.
export async function createCardFromFields(input: {
  userId: string;
  fields: GeneratedCardFields;
}) {
  const imagePath = await imageForNewCard(input.fields);
  return prisma.card.create({
    data: { userId: input.userId, ...cardColumns(input.fields), imageUrl: imagePath },
  });
}

// Builds the illustration prompt for a card. Kept in one place so both the
// on-demand "generate image" route and the AI-set preview use the same wording:
// depict the meaning, never render any text.
function cardImagePrompt(card: {
  word: string;
  example?: string | null;
  explanation?: string | null;
}): string {
  return [
    "A clean, friendly illustration for a vocabulary flashcard — a purely visual, wordless picture.",
    `It should clearly show the meaning of the word "${card.word}" so someone can guess the word just by looking.`,
    card.explanation ? `Meaning: ${card.explanation}.` : null,
    card.example ? `Scene/context: "${card.example}".` : null,
    "One clear main subject, soft pastel colors, simple uncluttered background, flat modern illustration style.",
    "Absolutely NO text of any kind: no letters, words, numbers, captions, labels, signs, speech bubbles, logos or watermarks anywhere in the image.",
  ]
    .filter(Boolean)
    .join(" ");
}

// Generates an illustration for a card and stores it, returning the relative
// image path (see storage.saveImage).
export async function generateCardImageFile(card: {
  word: string;
  example?: string | null;
  explanation?: string | null;
}): Promise<string> {
  const { buffer, contentType } = await generateImage(cardImagePrompt(card));
  return saveImage(buffer, contentType);
}

// Runs `fn` over `items` with at most `limit` in flight at once (image
// generation is slow/rate-limited, so we don't fire 30 requests at once).
async function mapPool<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await fn(items[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

// A generated-but-not-yet-saved card the user can accept or discard in the AI
// tab. Carries the raw fields (echoed back on save) plus display helpers.
export type CardSetPreview = {
  word: string;
  translation: string;
  example: string;
  imagePath: string | null;
  fields: GeneratedCardFields;
};

// Generates a themed batch of cards from a free-text request WITH an image each,
// but does NOT persist them - the user picks which to keep in the AI tab.
export async function generateCardSetPreview(input: {
  userId: string;
  request: string;
  max?: number;
}): Promise<CardSetPreview[]> {
  const max = Math.min(input.max ?? 30, 30);
  const [languages, levels, existing] = await Promise.all([
    userLanguages(input.userId),
    userLevels(input.userId),
    listUserWords(input.userId),
  ]);
  const fieldsList = await generateCardSet(input.request, languages, existing, max, levels);

  return mapPool(fieldsList, 4, async (fields) => ({
    word: fields.headword,
    translation: fields.translation,
    example: filledSentence(fields),
    imagePath: await imageForNewCard(fields),
    fields,
  }));
}

// Persists the cards the user chose to keep from an AI-set preview.
export async function saveGeneratedCards(input: {
  userId: string;
  cards: { fields: GeneratedCardFields; imagePath: string | null }[];
  deckId?: string;
}) {
  return Promise.all(
    input.cards.map((c) =>
      prisma.card.create({
        data: {
          userId: input.userId,
          ...cardColumns(c.fields),
          imageUrl: c.imagePath,
          deckId: input.deckId ?? null,
        },
      })
    )
  );
}

// Grammar practice built from the learner's own vocabulary, aimed at their CEFR
// band. Nothing is persisted - these are bonus drills, deliberately kept out of
// the daily count and streak, which measure card reviews.
export async function generateGrammarExercises(userId: string, count = 8) {
  const [languages, levels, words] = await Promise.all([
    userLanguages(userId),
    userLevels(userId),
    listUserWords(userId, 60),
  ]);
  return generateGrammarSet(languages, levels, words, count);
}

// Recent vocabulary, used to keep the word of the day from repeating cards.
export async function listUserWords(userId: string, limit = 150): Promise<string[]> {
  const cards = await prisma.card.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: { word: true },
  });
  return cards.map((c) => c.word);
}

// Returns null when the photo isn't obvious enough to name confidently.
export async function createCardFromImage(input: {
  userId: string;
  imagePath: string;
  deckId?: string;
}) {
  const fields = await generateCardFromImage(
    absoluteImageUrl(input.imagePath)!,
    await userLanguages(input.userId)
  );
  if (!fields) return null;

  return prisma.card.create({
    data: {
      userId: input.userId,
      ...cardColumns(fields),
      imageUrl: input.imagePath,
      deckId: input.deckId ?? null,
    },
  });
}

export async function regenerateCardWithComment(input: {
  cardId: string;
  userId: string;
  comment?: string;
}) {
  const card = await prisma.card.findFirstOrThrow({
    where: { id: input.cardId, userId: input.userId },
  });

  const fields = await regenerateCard({
    headword: card.word,
    previous: cardToFields(card),
    userComment: input.comment,
    languages: await userLanguages(input.userId),
  });

  // Keep the user's personal note across a regeneration.
  return prisma.card.update({ where: { id: card.id }, data: cardColumns(fields) });
}

// UTC calendar day (matching ReviewDay.day @db.Date) for a given instant.
function utcDay(date = new Date()): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

// The user's local calendar day, stored as a UTC-midnight Date so it still fits
// ReviewDay.day @db.Date. null tz => UTC (unchanged behavior for users who
// haven't opened the Mini App since timezone detection shipped).
function localDay(tz: string | null, date = new Date()): Date {
  if (!tz) return utcDay(date);
  try {
    const s = new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(date); // "2026-07-21"
    const [y, m, d] = s.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, d));
  } catch {
    return utcDay(date); // bad tz string => UTC
  }
}

// Records one review toward today's streak count. `learnedNow` marks a card
// that crossed the "learned" interval with this very review, which feeds the
// "learn N new words" quest.
export async function recordReview(userId: string, opts: { learnedNow?: boolean } = {}) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { timezone: true },
  });
  const day = localDay(user?.timezone ?? null);
  const learned = opts.learnedNow ? 1 : 0;
  await prisma.reviewDay.upsert({
    where: { userId_day: { userId, day } },
    update: { count: { increment: 1 }, newLearned: { increment: learned } },
    create: { userId, day, count: 1, newLearned: learned },
  });
  await settleQuests(userId);
}

// Records a finished review session (one "round") and its best combo, then
// returns the refreshed profile so the client can show the new streak/quests.
export async function completeSession(userId: string, bestCombo: number) {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { timezone: true },
  });
  const day = localDay(user.timezone);
  const existing = await prisma.reviewDay.findUnique({
    where: { userId_day: { userId, day } },
  });

  await prisma.reviewDay.upsert({
    where: { userId_day: { userId, day } },
    update: {
      sessions: { increment: 1 },
      bestCombo: Math.max(existing?.bestCombo ?? 0, bestCombo),
    },
    create: { userId, day, sessions: 1, bestCombo },
  });

  await settleQuests(userId);
  return getProfile(userId);
}

// Grants the day's reward (+1 streak freeze) once all of today's quests are
// done. The ReviewDay row carries the "already paid" flag, so this is safe to
// call after every review and every session.
async function settleQuests(userId: string) {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { timezone: true, dailyGoal: true },
  });
  const day = localDay(user.timezone);
  const row = await prisma.reviewDay.findUnique({ where: { userId_day: { userId, day } } });
  if (!row || row.questsRewarded) return;

  if (!allQuestsDone(dailyQuests(dayKey(day), user.dailyGoal, row))) return;

  await prisma.$transaction([
    prisma.reviewDay.update({ where: { id: row.id }, data: { questsRewarded: true } }),
    prisma.user.update({ where: { id: userId }, data: { streakFreezes: { increment: 1 } } }),
  ]);
}

// Spends a streak freeze to cover yesterday when its goal was missed, so a
// single skipped day doesn't reset the streak. Idempotent: the covered day is
// marked `frozen`, and only the one day back is ever considered - a freeze
// can't resurrect a streak that already ended.
async function applyStreakFreeze(userId: string, tz: string | null, dailyGoal: number) {
  const yesterday = localDay(tz);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);

  const day = await prisma.reviewDay.findUnique({
    where: { userId_day: { userId, day: yesterday } },
  });
  if (day && (day.count >= dailyGoal || day.frozen)) return; // nothing to cover

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { streakFreezes: true },
  });
  if (user.streakFreezes <= 0) return;

  // Only spend when there is an actual streak to protect.
  const before = new Date(yesterday);
  before.setUTCDate(before.getUTCDate() - 1);
  const prev = await prisma.reviewDay.findUnique({
    where: { userId_day: { userId, day: before } },
  });
  if (!prev || (prev.count < dailyGoal && !prev.frozen)) return;

  await prisma.$transaction([
    prisma.reviewDay.upsert({
      where: { userId_day: { userId, day: yesterday } },
      update: { frozen: true },
      create: { userId, day: yesterday, frozen: true },
    }),
    prisma.user.update({ where: { id: userId }, data: { streakFreezes: { decrement: 1 } } }),
  ]);
}

export type Profile = {
  learningLanguage: string;
  translationLanguage: string;
  // null = no explicit choice yet; client falls back to its own default.
  interfaceLanguage: string | null;
  dailyGoal: number;
  // IANA timezone used for day boundaries (null = UTC).
  timezone: string | null;
  // Whether the daily word-of-the-day message is sent.
  wordOfDayEnabled: boolean;
  // Whether the daily streak reminder is sent.
  reminderEnabled: boolean;
  // CEFR self-assessed level and goal.
  currentLevel: string;
  targetLevel: string;
  // Cards whose SRS interval is mature enough to count as "learned".
  learnedCount: number;
  // Referral deep link (null when the bot username isn't known) + invites made.
  referralLink: string | null;
  referralCount: number;
  todayCount: number;
  streak: number;
  // Today's quests (derived) and the freezes banked from completing them.
  quests: Quest[];
  streakFreezes: number;
  // { "2026-07-03": 12, ... } for roughly the last ~130 days.
  activity: Record<string, number>;
};

function dayKey(day: Date): string {
  return day.toISOString().slice(0, 10);
}

export async function getProfile(userId: string): Promise<Profile> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: {
      learningLanguage: true,
      translationLanguage: true,
      interfaceLanguage: true,
      dailyGoal: true,
      timezone: true,
      wordOfDayEnabled: true,
      reminderEnabled: true,
      currentLevel: true,
      targetLevel: true,
      streakFreezes: true,
    },
  });

  // May spend a banked freeze to cover yesterday before the streak is walked.
  await applyStreakFreeze(userId, user.timezone, user.dailyGoal);
  const streakFreezes = (
    await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { streakFreezes: true } })
  ).streakFreezes;

  const [learnedCount, referralCount] = await Promise.all([
    prisma.card.count({ where: { userId, interval: { gte: LEARNED_INTERVAL_DAYS } } }),
    prisma.user.count({ where: { referredById: userId } }),
  ]);

  const since = localDay(user.timezone);
  since.setUTCDate(since.getUTCDate() - 132);
  const days = await prisma.reviewDay.findMany({
    where: { userId, day: { gte: since } },
    orderBy: { day: "asc" },
  });

  const activity: Record<string, number> = {};
  const frozenDays = new Set<string>();
  for (const d of days) {
    activity[dayKey(d.day)] = d.count;
    if (d.frozen) frozenDays.add(dayKey(d.day));
  }

  const today = localDay(user.timezone);
  const todayKey = dayKey(today);
  const todayCount = activity[todayKey] ?? 0;

  // A day holds the streak when its goal was met or a freeze covered it.
  const held = (key: string) => (activity[key] ?? 0) >= user.dailyGoal || frozenDays.has(key);

  // Streak = consecutive days up to today meeting the goal. Today not yet met
  // doesn't break the streak (the day isn't over), it just doesn't extend it.
  let streak = 0;
  const cursor = localDay(user.timezone);
  if (todayCount < user.dailyGoal) cursor.setUTCDate(cursor.getUTCDate() - 1);
  while (held(dayKey(cursor))) {
    streak += 1;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }

  const todayRow = days.find((d) => dayKey(d.day) === todayKey);
  const quests = dailyQuests(todayKey, user.dailyGoal, {
    count: todayRow?.count ?? 0,
    sessions: todayRow?.sessions ?? 0,
    bestCombo: todayRow?.bestCombo ?? 0,
    newLearned: todayRow?.newLearned ?? 0,
  });

  return {
    learningLanguage: user.learningLanguage,
    translationLanguage: user.translationLanguage,
    interfaceLanguage: user.interfaceLanguage,
    dailyGoal: user.dailyGoal,
    timezone: user.timezone,
    wordOfDayEnabled: user.wordOfDayEnabled,
    reminderEnabled: user.reminderEnabled,
    currentLevel: user.currentLevel,
    targetLevel: user.targetLevel,
    learnedCount,
    referralLink: referralLink(userId),
    referralCount,
    todayCount,
    streak,
    quests,
    streakFreezes,
    activity,
  };
}

export async function updateProfile(
  userId: string,
  data: {
    learningLanguage?: string;
    translationLanguage?: string;
    interfaceLanguage?: string;
    dailyGoal?: number;
    timezone?: string;
    wordOfDayEnabled?: boolean;
    reminderEnabled?: boolean;
    currentLevel?: string;
    targetLevel?: string;
  }
) {
  await prisma.user.update({ where: { id: userId }, data });
  return getProfile(userId);
}
