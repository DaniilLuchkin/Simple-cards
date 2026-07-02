import { app } from "./app.js";
import { bot, setupBotProfile } from "./bot.js";
import { env } from "./env.js";

app.listen(env.PORT, () => {
  console.log(`API listening on :${env.PORT}`);
});

await setupBotProfile();
bot.start();
console.log("Telegram bot started (long polling)");
