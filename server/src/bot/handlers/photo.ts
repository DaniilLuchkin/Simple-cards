import type { Context } from "grammy";
import { env } from "../../env.js";
import { getOrCreateUser } from "../../services/userService.js";
import { createCard } from "../../services/cardService.js";
import { uploadImage } from "../../storage/localStorage.js";
import { parseWordInput } from "../parseInput.js";
import { pendingImageByChat } from "../state.js";
import { miniAppKeyboard } from "../keyboard.js";

export async function handlePhoto(ctx: Context) {
  const photos = ctx.message?.photo;
  if (!photos || !ctx.from || !ctx.chat) return;

  const largest = photos[photos.length - 1];
  const file = await ctx.api.getFile(largest.file_id);
  const fileUrl = `https://api.telegram.org/file/bot${env.TELEGRAM_BOT_TOKEN}/${file.file_path}`;

  const res = await fetch(fileUrl);
  const buffer = Buffer.from(await res.arrayBuffer());
  const contentType = res.headers.get("content-type") ?? "image/jpeg";

  const statusMsg = await ctx.reply("Загружаю картинку…");
  const imageUrl = await uploadImage(buffer, contentType);

  const caption = ctx.message?.caption;
  if (!caption) {
    pendingImageByChat.set(ctx.chat.id, { imageUrl });
    await ctx.api.editMessageText(
      ctx.chat.id,
      statusMsg.message_id,
      "Картинка получена! Теперь пришли слово (и пример, если хочешь), чтобы я сделал карточку."
    );
    return;
  }

  const user = await getOrCreateUser({
    telegramId: BigInt(ctx.from.id),
    username: ctx.from.username,
    firstName: ctx.from.first_name,
  });

  const { word, example } = parseWordInput(caption);

  await ctx.api.editMessageText(ctx.chat.id, statusMsg.message_id, "Генерирую карточку…");

  try {
    const card = await createCard({ userId: user.id, word, userExample: example, imageUrl });
    await ctx.api.editMessageText(
      ctx.chat.id,
      statusMsg.message_id,
      `Готово! Карточка для «${card.word}» добавлена.`
    );
    await ctx.reply("Открой Simple Cards, чтобы начать повторение:", {
      reply_markup: miniAppKeyboard(),
    });
  } catch (err) {
    console.error("Failed to generate card from photo", err);
    await ctx.api.editMessageText(
      ctx.chat.id,
      statusMsg.message_id,
      "Не получилось сгенерировать карточку. Попробуй ещё раз чуть позже."
    );
  }
}
