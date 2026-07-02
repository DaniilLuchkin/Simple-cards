import { Router } from "express";
import { z } from "zod";
import type { Card } from "@prisma/client";
import { prisma } from "./db.js";
import { sm2 } from "./sm2.js";
import { regenerateCardWithComment } from "./services.js";
import { absoluteImageUrl } from "./storage.js";

export const cardsRouter = Router();

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
