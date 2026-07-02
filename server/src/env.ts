import "dotenv/config";
import { z } from "zod";

// Railway injects RAILWAY_PUBLIC_DOMAIN once a public domain is generated for
// the service, which lets the URL-shaped settings below default sensibly there.
const railwayUrl = process.env.RAILWAY_PUBLIC_DOMAIN
  ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
  : undefined;

const schema = z.object({
  TELEGRAM_BOT_TOKEN: z.string().min(1),
  // Public HTTPS URL of the Mini App: the bot's web-app button target and the
  // default allowed CORS origin.
  MINI_APP_URL: z.string().url().optional(),
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
  PUBLIC_ORIGIN: z.string().url().optional(),
});

const parsed = schema.parse(process.env);

const MINI_APP_URL = parsed.MINI_APP_URL ?? railwayUrl;
if (!MINI_APP_URL) {
  throw new Error(
    "MINI_APP_URL is not set and could not be inferred from RAILWAY_PUBLIC_DOMAIN. " +
      "Set it explicitly (e.g. in .env for local dev, or generate a public domain on Railway)."
  );
}

export const env = {
  ...parsed,
  MINI_APP_URL,
  CORS_ORIGIN: parsed.CORS_ORIGIN ?? MINI_APP_URL,
  PUBLIC_ORIGIN: parsed.PUBLIC_ORIGIN ?? railwayUrl ?? MINI_APP_URL,
};
