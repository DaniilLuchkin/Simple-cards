import { InlineKeyboard } from "grammy";
import type { Bot } from "grammy";
import { prisma } from "./db.js";
import { env } from "./env.js";
import { generateWordOfDay } from "./llm.js";
import type { GeneratedCardFields } from "./llm.js";
import { listUserWords } from "./services.js";

const CHECK_INTERVAL_MS = 10 * 60 * 1000;

const wordOfDayKeyboard = new InlineKeyboard()
  .text("➕ Добавить", "wod:add")
  .text("Пропустить", "wod:skip");

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// The plain-text layout of this message is also the storage format the
// wod:add button parses the card fields back out of (survives restarts,
// no callback-data size limits). Keep formatMessage and parseMessage in sync.
function formatMessage(fields: GeneratedCardFields): string {
  return [
    "💡 Слово дня",
    "",
    `<b>${escapeHtml(fields.word)}</b>`,
    escapeHtml(fields.explanation),
    "",
    `Пример: ${escapeHtml(fields.example)}`,
    `Перевод: <tg-spoiler>${escapeHtml(fields.translation)}</tg-spoiler>`,
    "",
    "Добавить в колоду?",
  ].join("\n");
}

export function parseWordOfDayMessage(text: string): GeneratedCardFields | null {
  const lines = text.split("\n");
  const word = lines[2]?.trim();
  const explanation = lines[3]?.trim();
  const example = lines.find((l) => l.startsWith("Пример: "))?.slice("Пример: ".length).trim();
  const translation = lines.find((l) => l.startsWith("Перевод: "))?.slice("Перевод: ".length).trim();
  if (!word || !explanation || !example || !translation) return null;
  return { word, explanation, example, translation };
}

export async function sendWordOfDay(bot: Bot, user: { id: string; telegramId: bigint }) {
  const existingWords = await listUserWords(user.id);
  const fields = await generateWordOfDay(existingWords);

  await bot.api.sendMessage(Number(user.telegramId), formatMessage(fields), {
    parse_mode: "HTML",
    reply_markup: wordOfDayKeyboard,
  });

  await prisma.user.update({
    where: { id: user.id },
    data: { lastWordOfDayAt: new Date() },
  });
}

async function tick(bot: Bot) {
  const now = new Date();
  if (now.getUTCHours() !== env.WORD_OF_DAY_UTC_HOUR) return;

  const startOfTodayUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const users = await prisma.user.findMany({
    where: {
      OR: [{ lastWordOfDayAt: null }, { lastWordOfDayAt: { lt: startOfTodayUtc } }],
    },
    select: { id: true, telegramId: true },
  });

  for (const user of users) {
    try {
      await sendWordOfDay(bot, user);
    } catch (err) {
      // Blocked bots, deleted chats etc. - skip and try the next user.
      console.error(`Word of day failed for user ${user.id}`, err);
    }
  }
}

export function startWordOfDayScheduler(bot: Bot) {
  setInterval(() => {
    tick(bot).catch((err) => console.error("Word of day tick failed", err));
  }, CHECK_INTERVAL_MS);
}
