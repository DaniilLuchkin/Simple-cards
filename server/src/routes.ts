import { Router } from "express";
import { z } from "zod";
import type { Card } from "@prisma/client";
import { prisma } from "./db.js";
import { sm2 } from "./sm2.js";
import { getProfile, recordReview, regenerateCardWithComment, updateProfile } from "./services.js";
import { LANGUAGE_NAMES } from "./languages.js";
import { absoluteImageUrl } from "./storage.js";

export const cardsRouter = Router();
export const meRouter = Router();

const LANGUAGE_CODES = Object.keys(LANGUAGE_NAMES) as [string, ...string[]];

meRouter.get("/", async (req, res) => {
  res.json({ profile: await getProfile(req.dbUserId!) });
});

const profileSchema = z
  .object({
    learningLanguage: z.enum(LANGUAGE_CODES),
    translationLanguage: z.enum(LANGUAGE_CODES),
    dailyGoal: z.number().int().min(1).max(500),
  })
  .partial()
  .refine((d) => Object.keys(d).length > 0, { message: "No fields to update" });

meRouter.patch("/", async (req, res) => {
  const parsed = profileSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  res.json({ profile: await updateProfile(req.dbUserId!, parsed.data) });
});

// The DB stores a relative image path; clients get a full URL.
function toApiCard(card: Card) {
  return { ...card, imageUrl: absoluteImageUrl(card.imageUrl) };
}

// All cards due for review right now, oldest due date first.
cardsRouter.get("/due", async (req, res) => {
  const cards = await prisma.card.findMany({
    where: { userId: req.dbUserId!, status: "ACTIVE", dueAt: { lte: new Date() } },
    orderBy: { dueAt: "asc" },
  });
  res.json({ cards: cards.map(toApiCard) });
});

// Full library, for the "my cards" management view.
cardsRouter.get("/", async (req, res) => {
  const cards = await prisma.card.findMany({
    where: { userId: req.dbUserId!, status: "ACTIVE" },
    orderBy: { createdAt: "desc" },
  });
  res.json({ cards: cards.map(toApiCard) });
});

const reviewSchema = z.object({
  quality: z.enum(["remembered", "forgot"]),
});

cardsRouter.post("/:id/review", async (req, res) => {
  const parsed = reviewSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const card = await prisma.card.findFirst({
    where: { id: req.params.id, userId: req.dbUserId! },
  });
  if (!card) {
    res.status(404).json({ error: "Card not found" });
    return;
  }

  const result = sm2(card, parsed.data.quality);

  const updated = await prisma.card.update({
    where: { id: card.id },
    data: { ...result, lastReviewedAt: new Date() },
  });

  await recordReview(req.dbUserId!);

  res.json({ card: toApiCard(updated) });
});

// Restores the SM2 state a card had before its last review, so the client can
// offer "undo last swipe". The client sends back the snapshot it took before
// reviewing; values are bounded to what sm2() can legitimately produce.
const undoSchema = z.object({
  easeFactor: z.number().min(1.3).max(10),
  interval: z.number().int().min(0).max(36500),
  repetitions: z.number().int().min(0).max(10000),
  dueAt: z.string().datetime(),
  lastReviewedAt: z.string().datetime().nullable(),
});

cardsRouter.post("/:id/review/undo", async (req, res) => {
  const parsed = undoSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const card = await prisma.card.findFirst({
    where: { id: req.params.id, userId: req.dbUserId! },
  });
  if (!card) {
    res.status(404).json({ error: "Card not found" });
    return;
  }

  const updated = await prisma.card.update({
    where: { id: card.id },
    data: {
      easeFactor: parsed.data.easeFactor,
      interval: parsed.data.interval,
      repetitions: parsed.data.repetitions,
      dueAt: new Date(parsed.data.dueAt),
      lastReviewedAt: parsed.data.lastReviewedAt ? new Date(parsed.data.lastReviewedAt) : null,
    },
  });

  res.json({ card: toApiCard(updated) });
});

const regenerateSchema = z.object({
  comment: z.string().min(1).max(500),
});

cardsRouter.post("/:id/regenerate", async (req, res) => {
  const parsed = regenerateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  try {
    const card = await regenerateCardWithComment({
      cardId: req.params.id,
      userId: req.dbUserId!,
      comment: parsed.data.comment,
    });
    res.json({ card: toApiCard(card) });
  } catch (err) {
    console.error("Regenerate failed", err);
    res.status(500).json({ error: "Failed to regenerate card" });
  }
});

const updateSchema = z
  .object({
    word: z.string().min(1).max(200),
    example: z.string().min(1).max(500),
    explanation: z.string().min(1).max(1000),
    translation: z.string().min(1).max(300),
  })
  .partial()
  .refine((data) => Object.keys(data).length > 0, { message: "No fields to update" });

cardsRouter.patch("/:id", async (req, res) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const card = await prisma.card.findFirst({
    where: { id: req.params.id, userId: req.dbUserId! },
  });
  if (!card) {
    res.status(404).json({ error: "Card not found" });
    return;
  }

  const updated = await prisma.card.update({
    where: { id: card.id },
    data: parsed.data,
  });

  res.json({ card: toApiCard(updated) });
});

cardsRouter.delete("/:id", async (req, res) => {
  const card = await prisma.card.findFirst({
    where: { id: req.params.id, userId: req.dbUserId! },
  });
  if (!card) {
    res.status(404).json({ error: "Card not found" });
    return;
  }

  await prisma.card.delete({ where: { id: card.id } });
  res.status(204).end();
});
