import { app } from "./app.js";
import { bot } from "./bot/bot.js";
import { env } from "./env.js";

app.listen(env.PORT, () => {
  console.log(`API listening on :${env.PORT}`);
});

bot.start();
console.log("Telegram bot started (long polling)");
