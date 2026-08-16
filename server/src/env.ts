import "dotenv/config";
import { z } from "zod";

// Accepts both a full URL and a bare domain, so "cards.duckdns.org" pasted
// as-is works the same as "https://cards.duckdns.org".
// URLs can't contain whitespace or quotes, so those are typos - drop them.
function normalizeUrl(value: string | undefined): string | undefined {
  const trimmed = value?.replace(/[\s"']+/g, "");
  if (!trimmed) return undefined;
  const withScheme = /^https?:\/\//.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    return new URL(withScheme).toString().replace(/\/$/, "");
  } catch {
    throw new Error(`Invalid URL in environment: "${value}"`);
  }
}

const schema = z.object({
  TELEGRAM_BOT_TOKEN: z.string().min(1),
  // Public host of the deployment, e.g. "cards.duckdns.org" (bare domain or
  // full URL). docker-compose hands the same value to the reverse proxy that
  // terminates TLS, so the proxy and the app can't disagree about the public
  // origin. The URL-shaped settings below default to it.
  APP_DOMAIN: z.string().optional(),
  // Public HTTPS URL of the Mini App: the bot's web-app button target and the
  // default allowed CORS origin.
  MINI_APP_URL: z.string().optional(),
  CORS_ORIGIN: z.string().min(1).optional(),

  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string().min(1),

  OPENROUTER_API_KEY: z.string().min(1),
  OPENROUTER_MODEL: z.string().default("openai/gpt-5.6-luna"),
  // Image-capable model used to generate a card illustration on request.
  OPENROUTER_IMAGE_MODEL: z.string().default("google/gemini-2.5-flash-image-preview"),
  OPENROUTER_APP_NAME: z.string().default("Simple Cards"),

  // UTC hour at which the daily word-of-the-day is sent (9 = 12:00 MSK).
  WORD_OF_DAY_UTC_HOUR: z.coerce.number().int().min(0).max(23).default(9),
  // Local hour (in each user's timezone) at which the streak reminder is sent.
  REMINDER_LOCAL_HOUR: z.coerce.number().int().min(0).max(23).default(19),

  // Where uploaded card images are stored on disk. Point this at a mounted
  // volume (in Docker: /data/uploads) so images survive a redeploy.
  UPLOADS_DIR: z.string().default("uploads"),
  // Origin that serves /uploads (this server). Differs from MINI_APP_URL when
  // the Mini App is deployed as a separate service.
  PUBLIC_ORIGIN: z.string().optional(),
});

const parsed = schema.parse(process.env);

const appUrl = normalizeUrl(parsed.APP_DOMAIN);

const MINI_APP_URL = normalizeUrl(parsed.MINI_APP_URL) ?? appUrl;
if (!MINI_APP_URL) {
  throw new Error(
    "MINI_APP_URL is not set and could not be inferred from APP_DOMAIN. " +
      "Set APP_DOMAIN to the public host of this deployment " +
      "(e.g. cards.duckdns.org), or set MINI_APP_URL explicitly."
  );
}

export const env = {
  ...parsed,
  MINI_APP_URL,
  CORS_ORIGINS: (parsed.CORS_ORIGIN?.split(",") ?? [MINI_APP_URL])
    .map(normalizeUrl)
    .filter((origin): origin is string => Boolean(origin)),
  PUBLIC_ORIGIN: normalizeUrl(parsed.PUBLIC_ORIGIN) ?? appUrl ?? MINI_APP_URL,
};
