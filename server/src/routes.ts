import express, { Router } from "express";
import { z } from "zod";
import type { Card } from "@prisma/client";
import { prisma } from "./db.js";
import { sm2 } from "./sm2.js";
import {
  createCard,
  createCardFromImage,
  getProfile,
  recordReview,
  regenerateCardWithComment,
  updateProfile,
} from "./services.js";
import { generateImage, translateText } from "./llm.js";
import { gradeSchedule } from "./srsSchedule.js";
import { LANGUAGE_NAMES, languageName } from "./languages.js";
import { absoluteImageUrl, saveImage } from "./storage.js";

export const cardsRouter = Router();
export const meRouter = Router();
export const translateRouter = Router();

const LANGUAGE_CODES = Object.keys(LANGUAGE_NAMES) as [string, ...string[]];

// In-app translator: translate free text between two supported languages.
const translateSchema = z.object({
  text: z.string().min(1).max(1000),
  from: z.enum(LANGUAGE_CODES),
  to: z.enum(LANGUAGE_CODES),
});

translateRouter.post("/", async (req, res) => {
  const parsed = translateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  try {
    const translation = await translateText(
      parsed.data.text,
      languageName(parsed.data.from),
      languageName(parsed.data.to)
    );
    res.json({ translation });
  } catch (err) {
    console.error("Translate failed", err);
    res.status(502).json({ error: "Translate failed" });
  }
});

meRouter.get("/", async (req, res) => {
  res.json({ profile: await getProfile(req.dbUserId!) });
});

const profileSchema = z
  .object({
    learningLanguage: z.enum(LANGUAGE_CODES),
    translationLanguage: z.enum(LANGUAGE_CODES),
    interfaceLanguage: z.enum(LANGUAGE_CODES),
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

// The DB stores a relative image path; clients get a full URL. Also exposes the
// scheduling state as a nested `srs` object matching the web SRS types
// (easeFactor -> ease, repetitions -> reps), alongside the flat legacy fields.
function toApiCard(card: Card) {
  return {
    ...card,
    imageUrl: absoluteImageUrl(card.imageUrl),
    srs: {
      due: card.dueAt,
      interval: card.interval,
      ease: card.easeFactor,
      reps: card.repetitions,
      lapses: card.lapses,
    },
  };
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

// 4-grade review (Again/Hard/Good/Easy) for the SRS card.
const gradeSchema = z.object({
  grade: z.enum(["again", "hard", "good", "easy"]),
});

cardsRouter.post("/:id/grade", async (req, res) => {
  const parsed = gradeSchema.safeParse(req.body);
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

  const result = gradeSchedule(card, parsed.data.grade);
  const updated = await prisma.card.update({
    where: { id: card.id },
    data: { ...result, lastReviewedAt: new Date() },
  });

  await recordReview(req.dbUserId!);

  res.json({ card: toApiCard(updated) });
});

// Restores the scheduling state a card had before its last review, so the
// client can offer "undo". The client sends back the snapshot it took before
// reviewing; values are bounded to what the schedulers can legitimately produce.
const undoSchema = z.object({
  easeFactor: z.number().min(1.3).max(10),
  interval: z.number().int().min(0).max(36500),
  repetitions: z.number().int().min(0).max(10000),
  lapses: z.number().int().min(0).max(100000).optional(),
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
      lapses: parsed.data.lapses ?? card.lapses,
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

// Create a brand-new card from a word/phrase (e.g. from the translator).
const createSchema = z.object({
  word: z.string().min(1).max(200),
  example: z.string().max(500).optional(),
});

cardsRouter.post("/", async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  try {
    const card = await createCard({
      userId: req.dbUserId!,
      word: parsed.data.word,
      userExample: parsed.data.example,
    });
    res.status(201).json({ card: toApiCard(card) });
  } catch (err) {
    console.error("Failed to create card", err);
    res.status(500).json({ error: "Failed to create card" });
  }
});

// Create a brand-new card from a captured photo (mirrors the bot's photo flow).
// The raw image bytes are the body (Content-Type image/*).
cardsRouter.post(
  "/from-image",
  express.raw({ type: "image/*", limit: "12mb" }),
  async (req, res) => {
    const body = req.body as Buffer;
    if (!Buffer.isBuffer(body) || body.length === 0) {
      res.status(400).json({ error: "Empty image" });
      return;
    }
    try {
      const imagePath = await saveImage(body, req.get("content-type") ?? "image/jpeg");
      const card = await createCardFromImage({ userId: req.dbUserId!, imagePath });
      if (!card) {
        res.status(422).json({ error: "Could not recognize the photo" });
        return;
      }
      res.status(201).json({ card: toApiCard(card) });
    } catch (err) {
      console.error("Failed to create card from image", err);
      res.status(500).json({ error: "Failed to create card from image" });
    }
  }
);

const updateSchema = z
  .object({
    word: z.string().min(1).max(200),
    example: z.string().min(1).max(500),
    explanation: z.string().min(1).max(1000),
    translation: z.string().min(1).max(300),
    // Rich SRS fields, all editable in place from the review card.
    sentence: z.string().max(500),
    ipa: z.string().max(100),
    pos: z.string().max(100),
    forms: z.array(z.string().max(100)).max(20),
    collocations: z.array(z.string().max(200)).max(20),
    // The user's editable association from the SRS card back.
    personalNote: z.string().max(1000),
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

// Upload a custom image for a card. The raw image bytes are the request body
// (Content-Type image/*); global express.json() ignores non-JSON bodies, so the
// per-route express.raw parser owns it. Mirrors the bot's saveImage flow.
cardsRouter.post(
  "/:id/image",
  express.raw({ type: "image/*", limit: "12mb" }),
  async (req, res) => {
    const card = await prisma.card.findFirst({
      where: { id: req.params.id, userId: req.dbUserId! },
    });
    if (!card) {
      res.status(404).json({ error: "Card not found" });
      return;
    }

    const body = req.body as Buffer;
    if (!Buffer.isBuffer(body) || body.length === 0) {
      res.status(400).json({ error: "Empty image" });
      return;
    }

    try {
      const imageUrl = await saveImage(body, req.get("content-type") ?? "image/jpeg");
      const updated = await prisma.card.update({ where: { id: card.id }, data: { imageUrl } });
      res.json({ card: toApiCard(updated) });
    } catch (err) {
      console.error("Failed to save uploaded image", err);
      res.status(500).json({ error: "Failed to save image" });
    }
  }
);

// Generate a card illustration with an AI image model, store it, set imageUrl.
cardsRouter.post("/:id/image/generate", async (req, res) => {
  const card = await prisma.card.findFirst({
    where: { id: req.params.id, userId: req.dbUserId! },
  });
  if (!card) {
    res.status(404).json({ error: "Card not found" });
    return;
  }

  const prompt = [
    "A clear, simple, friendly illustration for a vocabulary flashcard.",
    `Depict the meaning of the word "${card.word}".`,
    card.example ? `Context: "${card.example}".` : null,
    card.explanation ? `Meaning: ${card.explanation}.` : null,
    "Single clear subject, soft pastel colors, no text or letters in the image.",
  ]
    .filter(Boolean)
    .join(" ");

  try {
    const { buffer, contentType } = await generateImage(prompt);
    const imageUrl = await saveImage(buffer, contentType);
    const updated = await prisma.card.update({ where: { id: card.id }, data: { imageUrl } });
    res.json({ card: toApiCard(updated) });
  } catch (err) {
    console.error("Failed to generate image", err);
    res.status(502).json({ error: "Failed to generate image" });
  }
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
