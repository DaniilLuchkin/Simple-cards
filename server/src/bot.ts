import { Bot, InlineKeyboard } from "grammy";
import type { Context } from "grammy";
import { env } from "./env.js";
import {
  createCard,
  createCardFromFields,
  createCardFromImage,
  creditReferral,
  getOrCreateUser,
  updateProfile,
} from "./services.js";
import { setBotUsername } from "./botInfo.js";
import { LANGUAGE_NATIVE_NAMES } from "./languages.js";
import { saveImage } from "./storage.js";
import { parseWordInput } from "./parseInput.js";
import { parseWordOfDayMessage, pendingWordOfDay, sendWordOfDay } from "./wordOfDay.js";

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
  "",
  "🌐 /language — выбрать язык интерфейса приложения.",
].join("\n");

// Confirmation shown in the language that was just picked, so the user gets
// immediate feedback they can read regardless of their previous setting.
const LANGUAGE_CONFIRM: Record<string, string> = {
  en: "Interface language set to English ✅",
  ru: "Язык интерфейса переключён на русский ✅",
  uk: "Мову інтерфейсу змінено на українську ✅",
  es: "Idioma de la interfaz cambiado a español ✅",
  de: "Oberflächensprache auf Deutsch geändert ✅",
  fr: "Langue de l’interface changée en français ✅",
  pt: "Idioma da interface alterado para português ✅",
  tr: "Arayüz dili Türkçe olarak ayarlandı ✅",
  id: "Bahasa antarmuka diatur ke Bahasa Indonesia ✅",
  zh: "界面语言已设置为中文 ✅",
  hi: "इंटरफ़ेस भाषा हिन्दी में बदल दी गई ✅",
  ar: "تم تغيير لغة الواجهة إلى العربية ✅",
  fa: "زبان رابط به فارسی تغییر کرد ✅",
};

function languageKeyboard(): InlineKeyboard {
  const kb = new InlineKeyboard();
  Object.entries(LANGUAGE_NATIVE_NAMES).forEach(([code, name], i) => {
    kb.text(name, `lang:${code}`);
    if (i % 2 === 1) kb.row();
  });
  return kb;
}

/**
 * One-time bot profile setup on startup: the menu button next to the message
 * box that opens the Mini App, the command list, and the description shown in
 * an empty chat before /start. Failures are logged but don't prevent startup
 * (e.g. locally MINI_APP_URL is not HTTPS, which Telegram rejects).
 */
export async function setupBotProfile() {
  try {
    // Cache the bot @username for building referral deep links.
    const me = await bot.api.getMe();
    setBotUsername(me.username ?? null);

    await bot.api.setMyCommands([
      { command: "start", description: "Как пользоваться ботом" },
      { command: "app", description: "Открыть Simple Cards" },
      { command: "word", description: "Слово дня прямо сейчас" },
      { command: "language", description: "Язык интерфейса / Interface language" },
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

bot.command("start", async (ctx) => {
  // Referral deep link: /start ref_<referrerUserId>. Only attribute genuinely
  // new users (account created just now), so an existing user clicking a link
  // isn't reassigned.
  const payload = ctx.match?.trim();
  if (payload?.startsWith("ref_")) {
    try {
      const user = await userFromCtx(ctx);
      if (Date.now() - user.createdAt.getTime() < 60_000) {
        await creditReferral(user.id, payload.slice("ref_".length));
      }
    } catch (err) {
      console.error("Referral credit failed", err);
    }
  }
  await ctx.reply(WELCOME_TEXT, { reply_markup: miniAppKeyboard });
});

bot.command("app", (ctx) =>
  ctx.reply("Открой Simple Cards, чтобы повторять карточки:", { reply_markup: miniAppKeyboard })
);

bot.command("language", (ctx) =>
  ctx.reply("🌐 Выбери язык интерфейса Simple Cards / Choose your interface language:", {
    reply_markup: languageKeyboard(),
  })
);

bot.callbackQuery(/^lang:(.+)$/, async (ctx) => {
  const code = ctx.match[1];
  if (!LANGUAGE_NATIVE_NAMES[code]) {
    await ctx.answerCallbackQuery();
    return;
  }

  try {
    const user = await userFromCtx(ctx);
    await updateProfile(user.id, { interfaceLanguage: code });
    await ctx.answerCallbackQuery({ text: LANGUAGE_NATIVE_NAMES[code] });
    await ctx.editMessageText(LANGUAGE_CONFIRM[code] ?? "✅", { reply_markup: miniAppKeyboard });
  } catch (err) {
    console.error("Failed to set interface language", err);
    await ctx.answerCallbackQuery({ text: "Error / Ошибка" });
  }
});

bot.command("word", async (ctx) => {
  try {
    const user = await userFromCtx(ctx);
    await sendWordOfDay(bot, user);
  } catch (err) {
    console.error("On-demand word of day failed", err);
    await ctx.reply("Не получилось подобрать слово. Попробуй ещё раз чуть позже.");
  }
});

// "Add" button under a word-of-the-day message: prefer the full generated
// fields stored in memory; fall back to re-parsing the message text (e.g. after
// a restart) for a valid, simpler card.
bot.callbackQuery("wod:add", async (ctx) => {
  const msg = ctx.callbackQuery.message;
  const key = msg ? `${msg.chat.id}:${msg.message_id}` : "";
  const fields = pendingWordOfDay.get(key) ?? (msg?.text ? parseWordOfDayMessage(msg.text) : null);
  if (!fields) {
    await ctx.answerCallbackQuery({ text: "Не удалось прочитать слово — пришли его текстом." });
    return;
  }

  try {
    // Answer and drop the buttons up front: drawing the card illustration below
    // can take longer than Telegram's ~10s callback-answer window.
    await ctx.answerCallbackQuery({ text: "Добавляю…" });
    await ctx.editMessageReplyMarkup();

    const user = await userFromCtx(ctx);
    await createCardFromFields({ userId: user.id, fields });
    await ctx.reply(`Готово! Карточка для «${fields.headword}» добавлена.`, {
      reply_markup: miniAppKeyboard,
    });
  } catch (err) {
    console.error("Failed to add word of day", err);
    await ctx.reply("Не получилось добавить карточку. Попробуй ещё раз чуть позже.");
  }
});

bot.callbackQuery("wod:skip", async (ctx) => {
  await ctx.answerCallbackQuery();
  await ctx.editMessageReplyMarkup(); // drop the buttons
});

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

  const imagePath = pendingImageByChat.get(ctx.chat.id);
  // Without a photo of their own we also draw an illustration, which takes a
  // few extra seconds - say so.
  const statusMsg = await ctx.reply(
    imagePath ? "Генерирую карточку…" : "Генерирую карточку и картинку…"
  );
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
