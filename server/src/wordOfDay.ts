import { InlineKeyboard } from "grammy";
import type { Bot } from "grammy";
import { prisma } from "./db.js";
import { env } from "./env.js";
import { filledSentence, generateWordOfDay } from "./llm.js";
import type { GeneratedCardFields } from "./llm.js";
import { languageNames } from "./languages.js";
import { listUserWords } from "./services.js";

const CHECK_INTERVAL_MS = 10 * 60 * 1000;

const wordOfDayKeyboard = new InlineKeyboard()
  .text("➕ Добавить", "wod:add")
  .text("Пропустить", "wod:skip");

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// The plain-text layout of this message is also the fallback storage the
// wod:add button parses fields back out of if the in-memory map was lost
// (e.g. across a restart). Keep formatMessage and parseWordOfDayMessage in sync.
function formatMessage(fields: GeneratedCardFields): string {
  return [
    "💡 Слово дня",
    "",
    `<b>${escapeHtml(fields.headword)}</b>`,
    escapeHtml(fields.explanation),
    "",
    `Пример: ${escapeHtml(filledSentence(fields))}`,
    `Перевод: <tg-spoiler>${escapeHtml(fields.translation)}</tg-spoiler>`,
    "",
    "Добавить в колоду?",
  ].join("\n");
}

// Fields that survive in the message text; the rich extras (ipa/pos/forms/
// collocations) are only recoverable from the in-memory map, so this fallback
// produces a valid but simpler card.
export function parseWordOfDayMessage(text: string): GeneratedCardFields | null {
  const lines = text.split("\n");
  const headword = lines[2]?.trim();
  const explanation = lines[3]?.trim();
  const example = lines.find((l) => l.startsWith("Пример: "))?.slice("Пример: ".length).trim();
  const translation = lines.find((l) => l.startsWith("Перевод: "))?.slice("Перевод: ".length).trim();
  if (!headword || !explanation || !example || !translation) return null;
  return {
    headword,
    ipa: "",
    pos: "",
    forms: [],
    sentence: example,
    explanation,
    translation,
    collocations: [],
  };
}

// Full generated fields keyed by "<chatId>:<messageId>", so wod:add can create
// a rich card without re-parsing the message. Lost on restart (falls back to
// parseWordOfDayMessage) — fine for a single-process bot.
export const pendingWordOfDay = new Map<string, GeneratedCardFields>();

export async function sendWordOfDay(
  bot: Bot,
  user: { id: string; telegramId: bigint; learningLanguage: string; translationLanguage: string }
) {
  const existingWords = await listUserWords(user.id);
  const fields = await generateWordOfDay(existingWords, languageNames(user));

  const sent = await bot.api.sendMessage(Number(user.telegramId), formatMessage(fields), {
    parse_mode: "HTML",
    reply_markup: wordOfDayKeyboard,
  });
  pendingWordOfDay.set(`${sent.chat.id}:${sent.message_id}`, fields);

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
    select: { id: true, telegramId: true, learningLanguage: true, translationLanguage: true },
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
