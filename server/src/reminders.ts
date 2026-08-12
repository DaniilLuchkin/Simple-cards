import { InlineKeyboard } from "grammy";
import type { Bot } from "grammy";
import { prisma } from "./db.js";
import { env } from "./env.js";
import { getProfile } from "./services.js";

const CHECK_INTERVAL_MS = 10 * 60 * 1000;

// The current hour (0-23) in the given IANA timezone; UTC when tz is null/bad.
function localHour(tz: string | null): number {
  const now = new Date();
  if (!tz) return now.getUTCHours();
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hour: "numeric",
      hourCycle: "h23",
    }).formatToParts(now);
    const h = parts.find((p) => p.type === "hour")?.value;
    return h ? Number(h) : now.getUTCHours();
  } catch {
    return now.getUTCHours();
  }
}

// "YYYY-MM-DD" calendar date in the given timezone (UTC when tz is null/bad).
function localDateKey(tz: string | null, date: Date): string {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: tz ?? "UTC",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(date);
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

function reminderText(streak: number, remaining: number): string {
  if (streak > 0) {
    return `🔥 Твоя серия — ${streak} ${plural(streak)}! Осталось ${remaining} ${cards(remaining)} до дневной цели. Не потеряй серию 💪`;
  }
  return `💪 Пора позаниматься! Осталось ${remaining} ${cards(remaining)} до дневной цели на сегодня.`;
}

function plural(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return "день";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return "дня";
  return "дней";
}

function cards(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return "карточка";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return "карточки";
  return "карточек";
}

async function tick(bot: Bot) {
  const now = new Date();
  const users = await prisma.user.findMany({
    where: { reminderEnabled: true },
    select: { id: true, telegramId: true, timezone: true, lastReminderAt: true },
  });

  for (const user of users) {
    try {
      if (localHour(user.timezone) !== env.REMINDER_LOCAL_HOUR) continue;
      // Only once per local day.
      if (
        user.lastReminderAt &&
        localDateKey(user.timezone, user.lastReminderAt) === localDateKey(user.timezone, now)
      ) {
        continue;
      }

      const profile = await getProfile(user.id);
      const remaining = profile.dailyGoal - profile.todayCount;
      if (remaining <= 0) continue; // goal already met - no nudge needed

      const keyboard = new InlineKeyboard().webApp("Открыть Simple Cards", env.MINI_APP_URL);
      await bot.api.sendMessage(Number(user.telegramId), reminderText(profile.streak, remaining), {
        reply_markup: keyboard,
      });
      await prisma.user.update({ where: { id: user.id }, data: { lastReminderAt: now } });
    } catch (err) {
      // Blocked bots, deleted chats etc. - skip and try the next user.
      console.error(`Reminder failed for user ${user.id}`, err);
    }
  }
}

export function startReminderScheduler(bot: Bot) {
  setInterval(() => {
    tick(bot).catch((err) => console.error("Reminder tick failed", err));
  }, CHECK_INTERVAL_MS);
}
