import { InlineKeyboard } from "grammy";
import { env } from "../env.js";

export function miniAppKeyboard() {
  return new InlineKeyboard().webApp("📚 Открыть Simple Cards", env.MINI_APP_URL);
}
