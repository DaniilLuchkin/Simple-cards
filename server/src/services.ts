import { prisma } from "./db.js";
import { generateCard, regenerateCard } from "./llm.js";

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

export async function createCard(input: {
  userId: string;
  word: string;
  userExample?: string;
  imageUrl?: string;
}) {
  const fields = await generateCard({
    word: input.word,
    userExample: input.userExample,
    imageUrl: input.imageUrl,
  });

  return prisma.card.create({
    data: { userId: input.userId, ...fields, imageUrl: input.imageUrl },
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
  });

  return prisma.card.update({ where: { id: card.id }, data: fields });
}
