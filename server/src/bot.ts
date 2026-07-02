import { Bot, InlineKeyboard } from "grammy";
import type { Context } from "grammy";
import { env } from "./env.js";
import { createCard, getOrCreateUser } from "./services.js";
import { saveImage } from "./storage.js";
import { parseWordInput } from "./parseInput.js";

export const bot = new Bot(env.TELEGRAM_BOT_TOKEN);

const miniAppKeyboard = new InlineKeyboard().webApp("📚 Открыть Simple Cards", env.MINI_APP_URL);

// Chats that sent a photo without a caption and still owe us a word for it.
// In-memory is fine while the bot runs as a single process.
const pendingImageByChat = new Map<number, string>();

bot.command("start", (ctx) =>
  ctx.reply(
    [
      "Привет! Это Simple Cards — бот для изучения английских слов.",
      "",
      "Пришли мне слово или фразу (можно с примером использования на следующей строке), картинку со словом в подписи — и я сделаю карточку для повторения по интервальной системе (SM2).",
    ].join("\n"),
    { reply_markup: miniAppKeyboard }
  )
);

bot.on("message:photo", async (ctx) => {
  const statusMsg = await ctx.reply("Загружаю картинку…");

  let imageUrl: string;
  try {
    const largest = ctx.message.photo[ctx.message.photo.length - 1];
    const file = await ctx.api.getFile(largest.file_id);
    const res = await fetch(`https://api.telegram.org/file/bot${env.TELEGRAM_BOT_TOKEN}/${file.file_path}`);
    if (!res.ok) throw new Error(`Photo download failed: ${res.status}`);
    imageUrl = await saveImage(
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
  if (!caption) {
    pendingImageByChat.set(ctx.chat.id, imageUrl);
    await ctx.api.editMessageText(
      ctx.chat.id,
      statusMsg.message_id,
      "Картинка получена! Теперь пришли слово (и пример, если хочешь), чтобы я сделал карточку."
    );
    return;
  }

  await ctx.api.editMessageText(ctx.chat.id, statusMsg.message_id, "Генерирую карточку…");
  await generateCardAndReply(ctx, statusMsg.message_id, { ...parseWordInput(caption), imageUrl });
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
  const imageUrl = pendingImageByChat.get(ctx.chat.id);
  const card = await generateCardAndReply(ctx, statusMsg.message_id, { word, example, imageUrl });
  // Keep the pending image on failure so the user can just retry the word.
  if (card) pendingImageByChat.delete(ctx.chat.id);
});

bot.catch((err) => {
  console.error("Unhandled bot error", err);
});

async function generateCardAndReply(
  ctx: Context,
  statusMsgId: number,
  input: { word: string; example?: string; imageUrl?: string }
) {
  const chatId = ctx.chat!.id;
  const from = ctx.from!;

  try {
    const user = await getOrCreateUser({
      telegramId: BigInt(from.id),
      username: from.username,
      firstName: from.first_name,
    });

    const card = await createCard({
      userId: user.id,
      word: input.word,
      userExample: input.example,
      imageUrl: input.imageUrl,
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
