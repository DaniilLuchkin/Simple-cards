import { Bot } from "grammy";
import { env } from "../env.js";
import { handleStart, handleText } from "./handlers/text.js";
import { handlePhoto } from "./handlers/photo.js";

export const bot = new Bot(env.TELEGRAM_BOT_TOKEN);

bot.command("start", handleStart);
bot.on("message:photo", handlePhoto);
bot.on("message:text", handleText);

bot.catch((err) => {
  console.error("Unhandled bot error", err);
});
