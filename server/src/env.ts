import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  TELEGRAM_BOT_TOKEN: z.string().min(1),
  MINI_APP_URL: z.string().url(),

  PORT: z.coerce.number().default(3000),
  CORS_ORIGIN: z.string().min(1),

  DATABASE_URL: z.string().min(1),

  OPENROUTER_API_KEY: z.string().min(1),
  OPENROUTER_MODEL: z.string().default("anthropic/claude-3.5-haiku"),
  OPENROUTER_SITE_URL: z.string().url().optional(),
  OPENROUTER_APP_NAME: z.string().default("Simple Cards"),

  S3_ENDPOINT: z.string().url(),
  S3_REGION: z.string().default("us-east-1"),
  S3_BUCKET: z.string().min(1),
  S3_ACCESS_KEY_ID: z.string().min(1),
  S3_SECRET_ACCESS_KEY: z.string().min(1),
  S3_FORCE_PATH_STYLE: z.coerce.boolean().default(true),
  S3_PUBLIC_URL: z.string().url(),
});

export const env = envSchema.parse(process.env);
