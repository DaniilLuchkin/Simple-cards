import type { CommandContext, Context } from "grammy";
import { getOrCreateUser } from "../../services/userService.js";
import { createCard } from "../../services/cardService.js";
import { parseWordInput } from "../parseInput.js";
import { pendingImageByChat } from "../state.js";
import { miniAppKeyboard } from "../keyboard.js";

export async function handleText(ctx: Context) {
  const message = ctx.message;
  if (!message?.text || !ctx.from || !ctx.chat) return;

  const user = await getOrCreateUser({
    telegramId: BigInt(ctx.from.id),
    username: ctx.from.username,
    firstName: ctx.from.first_name,
  });

  const pending = pendingImageByChat.get(ctx.chat.id);
  const { word, example } = parseWordInput(message.text);

  if (!word) {
    await ctx.reply("Пришли слово или фразу на английском, и я сделаю карточку ✨");
    return;
  }

  const statusMsg = await ctx.reply("Генерирую карточку…");

  try {
    const card = await createCard({
      userId: user.id,
      word,
      userExample: example,
      imageUrl: pending?.imageUrl,
    });

    if (pending) pendingImageByChat.delete(ctx.chat.id);

    await ctx.api.editMessageText(
      ctx.chat.id,
      statusMsg.message_id,
      `Готово! Карточка для «${card.word}» добавлена.`
    );
    await ctx.reply("Открой Simple Cards, чтобы начать повторение:", {
      reply_markup: miniAppKeyboard(),
    });
  } catch (err) {
    console.error("Failed to generate card", err);
    await ctx.api.editMessageText(
      ctx.chat.id,
      statusMsg.message_id,
      "Не получилось сгенерировать карточку. Попробуй ещё раз чуть позже."
    );
  }
}

export async function handleStart(ctx: CommandContext<Context>) {
  await ctx.reply(
    [
      "Привет! Это Simple Cards — бот для изучения английских слов.",
      "",
      "Пришли мне слово или фразу (можно с примером использования на следующей строке), картинку со словом в подписи — и я сделаю карточку для повторения по интервальной системе (SM2).",
    ].join("\n"),
    { reply_markup: miniAppKeyboard() }
  );
}
