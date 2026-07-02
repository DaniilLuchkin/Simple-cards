import { Bot, InlineKeyboard } from "grammy";
import type { Context } from "grammy";
import { env } from "./env.js";
import { createCard, createCardFromImage, getOrCreateUser } from "./services.js";
import { saveImage } from "./storage.js";
import { parseWordInput } from "./parseInput.js";

export const bot = new Bot(env.TELEGRAM_BOT_TOKEN);

const miniAppKeyboard = new InlineKeyboard().webApp("📚 Открыть Simple Cards", env.MINI_APP_URL);

// Chats that sent a photo we couldn't auto-recognize and still owe us a word.
// In-memory is fine while the bot runs as a single process.
const pendingImageByChat = new Map<number, string>();

const WELCOME_TEXT = [
  "Привет! Это Simple Cards — бот для изучения английских слов.",
  "",
  "📝 Пришли слово или фразу (можно с примером на следующей строке) — я сделаю карточку.",
  "📷 Пришли фото — я сам пойму, что на нём, и сделаю карточку. Если хочешь конкретное слово, добавь его в подпись.",
  "",
  "Повторение — свайпами в мини-приложении, по интервальной системе (SM2), как в Anki.",
].join("\n");

/**
 * One-time bot profile setup on startup: the menu button next to the message
 * box that opens the Mini App, the command list, and the description shown in
 * an empty chat before /start. Failures are logged but don't prevent startup
 * (e.g. locally MINI_APP_URL is not HTTPS, which Telegram rejects).
 */
export async function setupBotProfile() {
  try {
    await bot.api.setMyCommands([
      { command: "start", description: "Как пользоваться ботом" },
      { command: "app", description: "Открыть Simple Cards" },
    ]);
    await bot.api.raw.setChatMenuButton({
      menu_button: { type: "web_app", text: "Карточки", web_app: { url: env.MINI_APP_URL } },
    });
    await bot.api.raw.setMyShortDescription({
      short_description: "Карточки для изучения английских слов с повторением как в Anki",
    });
    await bot.api.raw.setMyDescription({
      description:
        "Пришли слово, фразу или фото — я сделаю карточку для изучения английского. " +
        "Повторяй карточки свайпами в мини-приложении по интервальной системе (SM2), как в Anki.",
    });
  } catch (err) {
    console.warn("Bot profile setup failed (non-fatal)", err);
  }
}

bot.command("start", (ctx) => ctx.reply(WELCOME_TEXT, { reply_markup: miniAppKeyboard }));

bot.command("app", (ctx) =>
  ctx.reply("Открой Simple Cards, чтобы повторять карточки:", { reply_markup: miniAppKeyboard })
);

bot.on("message:photo", async (ctx) => {
  const statusMsg = await ctx.reply("Загружаю картинку…");

  let imagePath: string;
  try {
    const largest = ctx.message.photo[ctx.message.photo.length - 1];
    const file = await ctx.api.getFile(largest.file_id);
    const res = await fetch(`https://api.telegram.org/file/bot${env.TELEGRAM_BOT_TOKEN}/${file.file_path}`);
    if (!res.ok) throw new Error(`Photo download failed: ${res.status}`);
    imagePath = await saveImage(
      Buffer.from(await res.arrayBuffer()),
      res.headers.get("content-type") ?? "image/jpeg"
    );
  } catch (err) {
    console.error("Failed to store photo", err);
    await ctx.api.editMessageText(
      ctx.chat.id,
      statusMsg.message_id,
      "Не получилось сохранить картинку. Попробуй ещё раз чуть позже."
    );
    return;
  }

  const caption = ctx.message.caption?.trim();
  if (caption) {
    await ctx.api.editMessageText(ctx.chat.id, statusMsg.message_id, "Генерирую карточку…");
    await generateCardAndReply(ctx, statusMsg.message_id, { ...parseWordInput(caption), imagePath });
    return;
  }

  // No caption: let the LLM figure out what's in the photo. If it isn't
  // confident, fall back to asking the user for the word.
  await ctx.api.editMessageText(ctx.chat.id, statusMsg.message_id, "Смотрю, что на фото…");
  try {
    const user = await userFromCtx(ctx);
    const card = await createCardFromImage({ userId: user.id, imagePath });
    if (card) {
      await ctx.api.editMessageText(
        ctx.chat.id,
        statusMsg.message_id,
        `Готово! Карточка для «${card.word}» добавлена.`
      );
      await ctx.reply("Открой Simple Cards, чтобы начать повторение:", { reply_markup: miniAppKeyboard });
      return;
    }
  } catch (err) {
    console.error("Photo auto-recognition failed", err);
  }

  pendingImageByChat.set(ctx.chat.id, imagePath);
  await ctx.api.editMessageText(
    ctx.chat.id,
    statusMsg.message_id,
    "Не уверен, что на фото. Пришли слово (и пример, если хочешь) — я сделаю карточку с этой картинкой."
  );
});

bot.on("message:text", async (ctx) => {
  const text = ctx.message.text.trim();
  // Unknown /commands are not vocabulary - don't turn them into cards.
  if (text.startsWith("/")) return;

  const { word, example } = parseWordInput(text);
  if (!word) {
    await ctx.reply("Пришли слово или фразу на английском, и я сделаю карточку ✨");
    return;
  }

  const statusMsg = await ctx.reply("Генерирую карточку…");
  const imagePath = pendingImageByChat.get(ctx.chat.id);
  const card = await generateCardAndReply(ctx, statusMsg.message_id, { word, example, imagePath });
  // Keep the pending image on failure so the user can just retry the word.
  if (card) pendingImageByChat.delete(ctx.chat.id);
});

bot.catch((err) => {
  console.error("Unhandled bot error", err);
});

function userFromCtx(ctx: Context) {
  const from = ctx.from!;
  return getOrCreateUser({
    telegramId: BigInt(from.id),
    username: from.username,
    firstName: from.first_name,
  });
}

async function generateCardAndReply(
  ctx: Context,
  statusMsgId: number,
  input: { word: string; example?: string; imagePath?: string }
) {
  const chatId = ctx.chat!.id;

  try {
    const user = await userFromCtx(ctx);

    const card = await createCard({
      userId: user.id,
      word: input.word,
      userExample: input.example,
      imagePath: input.imagePath,
    });

    await ctx.api.editMessageText(chatId, statusMsgId, `Готово! Карточка для «${card.word}» добавлена.`);
    await ctx.reply("Открой Simple Cards, чтобы начать повторение:", { reply_markup: miniAppKeyboard });
    return card;
  } catch (err) {
    console.error("Failed to generate card", err);
    await ctx.api.editMessageText(
      chatId,
      statusMsgId,
      "Не получилось сгенерировать карточку. Попробуй ещё раз чуть позже."
    );
    return null;
  }
}
