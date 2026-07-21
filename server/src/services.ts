import type { Card } from "@prisma/client";
import { prisma } from "./db.js";
import {
  filledSentence,
  generateCard,
  generateCardFromImage,
  generateCardSet,
  generateImage,
  regenerateCard,
} from "./llm.js";
import type { GeneratedCardFields } from "./llm.js";
import { languageNames } from "./languages.js";
import type { Languages } from "./languages.js";
import { absoluteImageUrl, saveImage } from "./storage.js";

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

async function userLanguages(userId: string): Promise<Languages> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { learningLanguage: true, translationLanguage: true },
  });
  return languageNames(user);
}

export async function createCard(input: {
  userId: string;
  word: string;
  userExample?: string;
  imagePath?: string;
}) {
  const fields = await generateCard({
    word: input.word,
    userExample: input.userExample,
    // The LLM fetches the image itself, so it needs the full public URL.
    imageUrl: absoluteImageUrl(input.imagePath ?? null) ?? undefined,
    languages: await userLanguages(input.userId),
  });

  return prisma.card.create({
    data: { userId: input.userId, ...cardColumns(fields), imageUrl: input.imagePath },
  });
}

// For flows where the fields were already generated (e.g. accepting the word
// of the day) - no LLM round-trip.
export function createCardFromFields(input: { userId: string; fields: GeneratedCardFields }) {
  return prisma.card.create({
    data: { userId: input.userId, ...cardColumns(input.fields) },
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
  const [languages, existing] = await Promise.all([
    userLanguages(input.userId),
    listUserWords(input.userId),
  ]);
  const fieldsList = await generateCardSet(input.request, languages, existing, max);

  return mapPool(fieldsList, 4, async (fields) => {
    const example = filledSentence(fields);
    let imagePath: string | null = null;
    try {
      imagePath = await generateCardImageFile({
        word: fields.headword,
        example,
        explanation: fields.explanation,
      });
    } catch (err) {
      // A failed image shouldn't drop the card - it just shows without one.
      console.error("Preview image generation failed", err);
    }
    return { word: fields.headword, translation: fields.translation, example, imagePath, fields };
  });
}

// Persists the cards the user chose to keep from an AI-set preview.
export async function saveGeneratedCards(input: {
  userId: string;
  cards: { fields: GeneratedCardFields; imagePath: string | null }[];
}) {
  return Promise.all(
    input.cards.map((c) =>
      prisma.card.create({
        data: { userId: input.userId, ...cardColumns(c.fields), imageUrl: c.imagePath },
      })
    )
  );
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
export async function createCardFromImage(input: { userId: string; imagePath: string }) {
  const fields = await generateCardFromImage(
    absoluteImageUrl(input.imagePath)!,
    await userLanguages(input.userId)
  );
  if (!fields) return null;

  return prisma.card.create({
    data: { userId: input.userId, ...cardColumns(fields), imageUrl: input.imagePath },
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

// Records one review toward today's streak count.
export async function recordReview(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { timezone: true },
  });
  const day = localDay(user?.timezone ?? null);
  await prisma.reviewDay.upsert({
    where: { userId_day: { userId, day } },
    update: { count: { increment: 1 } },
    create: { userId, day, count: 1 },
  });
}

export type Profile = {
  learningLanguage: string;
  translationLanguage: string;
  // null = no explicit choice yet; client falls back to its own default.
  interfaceLanguage: string | null;
  dailyGoal: number;
  // IANA timezone used for day boundaries (null = UTC).
  timezone: string | null;
  todayCount: number;
  streak: number;
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
    },
  });

  const since = localDay(user.timezone);
  since.setUTCDate(since.getUTCDate() - 132);
  const days = await prisma.reviewDay.findMany({
    where: { userId, day: { gte: since } },
    orderBy: { day: "asc" },
  });

  const activity: Record<string, number> = {};
  for (const d of days) activity[dayKey(d.day)] = d.count;

  const todayKey = dayKey(localDay(user.timezone));
  const todayCount = activity[todayKey] ?? 0;

  // Streak = consecutive days up to today meeting the goal. Today not yet met
  // doesn't break the streak (the day isn't over), it just doesn't extend it.
  let streak = 0;
  const cursor = localDay(user.timezone);
  if (todayCount < user.dailyGoal) cursor.setUTCDate(cursor.getUTCDate() - 1);
  while ((activity[dayKey(cursor)] ?? 0) >= user.dailyGoal) {
    streak += 1;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }

  return {
    learningLanguage: user.learningLanguage,
    translationLanguage: user.translationLanguage,
    interfaceLanguage: user.interfaceLanguage,
    dailyGoal: user.dailyGoal,
    timezone: user.timezone,
    todayCount,
    streak,
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
  }
) {
  await prisma.user.update({ where: { id: userId }, data });
  return getProfile(userId);
}
