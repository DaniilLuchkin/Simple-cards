import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../db.js";
import { sm2 } from "../../sm2.js";
import { regenerateCardWithComment } from "../../services/cardService.js";

export const cardsRouter = Router();

// All cards due for review right now, oldest due date first.
cardsRouter.get("/due", async (req, res) => {
  const cards = await prisma.card.findMany({
    where: { userId: req.dbUserId!, status: "ACTIVE", dueAt: { lte: new Date() } },
    orderBy: { dueAt: "asc" },
  });
  res.json({ cards });
});

// Full library, for a "my cards" / management view.
cardsRouter.get("/", async (req, res) => {
  const cards = await prisma.card.findMany({
    where: { userId: req.dbUserId!, status: "ACTIVE" },
    orderBy: { createdAt: "desc" },
  });
  res.json({ cards });
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
    data: {
      easeFactor: result.easeFactor,
      interval: result.interval,
      repetitions: result.repetitions,
      dueAt: result.dueAt,
      lastReviewedAt: new Date(),
    },
  });

  res.json({ card: updated });
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
    res.json({ card });
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

  res.json({ card: updated });
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
