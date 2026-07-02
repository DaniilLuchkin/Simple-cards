import "dotenv/config";
import { z } from "zod";

// Accepts both a full URL and a bare domain (Railway shows domains without a
// scheme, so "web-production-xxxx.up.railway.app" pasted as-is should work).
function normalizeUrl(value: string | undefined): string | undefined {
  const trimmed = value?.trim().replace(/^["']+|["']+$/g, "");
  if (!trimmed) return undefined;
  const withScheme = /^https?:\/\//.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    return new URL(withScheme).toString().replace(/\/$/, "");
  } catch {
    throw new Error(`Invalid URL in environment: "${value}"`);
  }
}

// Railway injects RAILWAY_PUBLIC_DOMAIN once a public domain is generated for
// the service, which lets the URL-shaped settings below default sensibly there.
const railwayUrl = normalizeUrl(process.env.RAILWAY_PUBLIC_DOMAIN);

const schema = z.object({
  TELEGRAM_BOT_TOKEN: z.string().min(1),
  // Public HTTPS URL of the Mini App: the bot's web-app button target and the
  // default allowed CORS origin.
  MINI_APP_URL: z.string().optional(),
  CORS_ORIGIN: z.string().min(1).optional(),

  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string().min(1),

  OPENROUTER_API_KEY: z.string().min(1),
  OPENROUTER_MODEL: z.string().default("anthropic/claude-3.5-haiku"),
  OPENROUTER_APP_NAME: z.string().default("Simple Cards"),

  // Where uploaded card images are stored on disk. Point this at a mounted
  // volume (e.g. /data/uploads) for persistence across deploys.
  UPLOADS_DIR: z.string().default("uploads"),
  // Origin that serves /uploads (this server). Differs from MINI_APP_URL when
  // the Mini App is deployed as a separate service.
  PUBLIC_ORIGIN: z.string().optional(),
});

const parsed = schema.parse(process.env);

const MINI_APP_URL = normalizeUrl(parsed.MINI_APP_URL) ?? railwayUrl;
if (!MINI_APP_URL) {
  throw new Error(
    "MINI_APP_URL is not set and could not be inferred from RAILWAY_PUBLIC_DOMAIN. " +
      "Set it explicitly (e.g. in .env for local dev, or generate a public domain on Railway)."
  );
}

export const env = {
  ...parsed,
  MINI_APP_URL,
  CORS_ORIGINS: (parsed.CORS_ORIGIN?.split(",") ?? [MINI_APP_URL])
    .map(normalizeUrl)
    .filter((origin): origin is string => Boolean(origin)),
  PUBLIC_ORIGIN: normalizeUrl(parsed.PUBLIC_ORIGIN) ?? railwayUrl ?? MINI_APP_URL,
};
