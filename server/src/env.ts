import "dotenv/config";
import { z } from "zod";

// Railway injects this automatically once a public domain is generated for the
// service, so MINI_APP_URL/CORS_ORIGIN/OPENROUTER_SITE_URL can be inferred from
// it instead of requiring manual configuration in the common single-service setup.
const RAILWAY_PUBLIC_DOMAIN = process.env.RAILWAY_PUBLIC_DOMAIN;
const inferredPublicUrl = RAILWAY_PUBLIC_DOMAIN ? `https://${RAILWAY_PUBLIC_DOMAIN}` : undefined;

const envSchema = z.object({
  TELEGRAM_BOT_TOKEN: z.string().min(1),
  // Public HTTPS URL of this app (used as the bot's "Open Simple Cards" button,
  // and as the allowed CORS origin). Defaults to the Railway-provided domain.
  MINI_APP_URL: z.string().url().optional(),
  CORS_ORIGIN: z.string().min(1).optional(),

  PORT: z.coerce.number().default(3000),

  DATABASE_URL: z.string().min(1),

  OPENROUTER_API_KEY: z.string().min(1),
  OPENROUTER_MODEL: z.string().default("anthropic/claude-3.5-haiku"),
  OPENROUTER_SITE_URL: z.string().url().optional(),
  OPENROUTER_APP_NAME: z.string().default("Simple Cards"),

  // Where uploaded card images are stored on disk. Point this at a mounted
  // Railway volume (e.g. "/data/uploads") for persistence across deploys;
  // defaults to a local folder on the ephemeral filesystem otherwise.
  UPLOADS_DIR: z.string().default("uploads"),
  // Only needed if the API is served from a different origin than the one
  // serving images (e.g. running web/server as two separate services).
  // Leave unset in the default single-service setup - image URLs are then
  // same-origin relative paths.
  PUBLIC_ORIGIN: z.string().url().optional(),
});

const parsed = envSchema.parse(process.env);

const MINI_APP_URL = parsed.MINI_APP_URL ?? inferredPublicUrl;
if (!MINI_APP_URL) {
  throw new Error(
    "MINI_APP_URL is not set and could not be inferred from RAILWAY_PUBLIC_DOMAIN. " +
      "Set it explicitly (e.g. in .env for local dev, or generate a public domain on Railway)."
  );
}

export const env = {
  ...parsed,
  MINI_APP_URL,
  CORS_ORIGIN: parsed.CORS_ORIGIN ?? inferredPublicUrl ?? MINI_APP_URL,
  OPENROUTER_SITE_URL: parsed.OPENROUTER_SITE_URL ?? inferredPublicUrl,
};
