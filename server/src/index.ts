import { app } from "./app.js";
import { bot, setupBotProfile } from "./bot.js";
import { prisma } from "./db.js";
import { env } from "./env.js";
import { startWordOfDayScheduler } from "./wordOfDay.js";
import { startReminderScheduler } from "./reminders.js";

const server = app.listen(env.PORT, () => {
  console.log(`API listening on :${env.PORT}`);
});

await setupBotProfile();
startWordOfDayScheduler(bot);
startReminderScheduler(bot);
bot.start();
console.log("Telegram bot started (long polling)");

// Long polling means exactly one process may hold the update stream, so a
// restart has to hand it back deliberately: bot.stop() finishes the handlers
// already running and stops fetching. Without this, a redeploy drops an update
// mid-flight and the new container races the old one for getUpdates (Telegram
// answers 409). Docker sends SIGTERM and waits out stop_grace_period.
let shuttingDown = false;

async function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`${signal} received, shutting down`);

  const forceExit = setTimeout(() => {
    console.error("Graceful shutdown timed out, exiting");
    process.exit(1);
  }, 15_000);
  forceExit.unref();

  try {
    await bot.stop();
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
      // Keep-alive connections from the reverse proxy would otherwise hold the
      // server open until the force-exit timer fires.
      server.closeIdleConnections();
    });
    await prisma.$disconnect();
  } catch (err) {
    console.error("Shutdown error", err);
  }

  // Explicit: the two schedulers are setInterval timers that keep the event
  // loop alive forever, so the process would never exit on its own.
  process.exit(0);
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
