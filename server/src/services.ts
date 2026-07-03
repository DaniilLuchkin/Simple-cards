import { prisma } from "./db.js";
import { generateCard, generateCardFromImage, regenerateCard } from "./llm.js";
import type { GeneratedCardFields } from "./llm.js";
import { languageNames } from "./languages.js";
import type { Languages } from "./languages.js";
import { absoluteImageUrl } from "./storage.js";

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
    data: { userId: input.userId, ...fields, imageUrl: input.imagePath },
  });
}

// For flows where the fields were already generated (e.g. accepting the word
// of the day) - no LLM round-trip.
export function createCardFromFields(input: { userId: string; fields: GeneratedCardFields }) {
  return prisma.card.create({
    data: { userId: input.userId, ...input.fields },
  });
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
    data: { userId: input.userId, ...fields, imageUrl: input.imagePath },
  });
}

export async function regenerateCardWithComment(input: {
  cardId: string;
  userId: string;
  comment: string;
}) {
  const card = await prisma.card.findFirstOrThrow({
    where: { id: input.cardId, userId: input.userId },
  });

  const fields = await regenerateCard({
    word: card.word,
    previous: {
      word: card.word,
      example: card.example,
      explanation: card.explanation,
      translation: card.translation,
    },
    userComment: input.comment,
    languages: await userLanguages(input.userId),
  });

  return prisma.card.update({ where: { id: card.id }, data: fields });
}

// UTC calendar day (matching ReviewDay.day @db.Date) for a given instant.
function utcDay(date = new Date()): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

// Records one review toward today's streak count.
export async function recordReview(userId: string) {
  const day = utcDay();
  await prisma.reviewDay.upsert({
    where: { userId_day: { userId, day } },
    update: { count: { increment: 1 } },
    create: { userId, day, count: 1 },
  });
}

export type Profile = {
  learningLanguage: string;
  translationLanguage: string;
  dailyGoal: number;
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
    select: { learningLanguage: true, translationLanguage: true, dailyGoal: true },
  });

  const since = utcDay();
  since.setUTCDate(since.getUTCDate() - 132);
  const days = await prisma.reviewDay.findMany({
    where: { userId, day: { gte: since } },
    orderBy: { day: "asc" },
  });

  const activity: Record<string, number> = {};
  for (const d of days) activity[dayKey(d.day)] = d.count;

  const todayKey = dayKey(utcDay());
  const todayCount = activity[todayKey] ?? 0;

  // Streak = consecutive days up to today meeting the goal. Today not yet met
  // doesn't break the streak (the day isn't over), it just doesn't extend it.
  let streak = 0;
  const cursor = utcDay();
  if (todayCount < user.dailyGoal) cursor.setUTCDate(cursor.getUTCDate() - 1);
  while ((activity[dayKey(cursor)] ?? 0) >= user.dailyGoal) {
    streak += 1;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }

  return {
    learningLanguage: user.learningLanguage,
    translationLanguage: user.translationLanguage,
    dailyGoal: user.dailyGoal,
    todayCount,
    streak,
    activity,
  };
}

export async function updateProfile(
  userId: string,
  data: { learningLanguage?: string; translationLanguage?: string; dailyGoal?: number }
) {
  await prisma.user.update({ where: { id: userId }, data });
  return getProfile(userId);
}
