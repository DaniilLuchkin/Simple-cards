import crypto from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { env } from "../env.js";
import { getOrCreateUser } from "../services/userService.js";

export type TelegramUser = {
  id: number;
  username?: string;
  first_name?: string;
};

declare global {
  namespace Express {
    interface Request {
      dbUserId?: string;
    }
  }
}

/**
 * Validates the Telegram Mini App `initData` string sent by the client.
 * https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 */
function verifyInitData(initData: string): TelegramUser | null {
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) return null;
  params.delete("hash");

  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");

  const secretKey = crypto.createHmac("sha256", "WebAppData").update(env.TELEGRAM_BOT_TOKEN).digest();
  const computedHash = crypto.createHmac("sha256", secretKey).update(dataCheckString).digest("hex");

  if (computedHash !== hash) return null;

  const authDate = Number(params.get("auth_date") ?? 0);
  const maxAgeSeconds = 24 * 60 * 60;
  if (!authDate || Date.now() / 1000 - authDate > maxAgeSeconds) return null;

  const userRaw = params.get("user");
  if (!userRaw) return null;

  try {
    return JSON.parse(userRaw) as TelegramUser;
  } catch {
    return null;
  }
}

export async function telegramAuth(req: Request, res: Response, next: NextFunction) {
  const initData = req.header("X-Telegram-Init-Data");
  if (!initData) {
    res.status(401).json({ error: "Missing Telegram init data" });
    return;
  }

  const tgUser = verifyInitData(initData);
  if (!tgUser) {
    res.status(401).json({ error: "Invalid Telegram init data" });
    return;
  }

  const user = await getOrCreateUser({
    telegramId: BigInt(tgUser.id),
    username: tgUser.username,
    firstName: tgUser.first_name,
  });

  req.dbUserId = user.id;
  next();
}
