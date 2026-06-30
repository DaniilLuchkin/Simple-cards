import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { env } from "../env.js";

const EXT_BY_CONTENT_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

export async function uploadImage(buffer: Buffer, contentType: string): Promise<string> {
  const ext = EXT_BY_CONTENT_TYPE[contentType] ?? "jpg";
  const fileName = `${randomUUID()}.${ext}`;
  const dir = path.join(env.UPLOADS_DIR, "cards");
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, fileName), buffer);

  // Always return an absolute URL: it's stored as-is and also handed to the
  // LLM as an image input, which needs to be able to fetch it itself.
  // PUBLIC_ORIGIN overrides this when images are served from a different
  // origin than MINI_APP_URL (e.g. server/web split into two services).
  const origin = env.PUBLIC_ORIGIN ?? env.MINI_APP_URL;
  return `${origin.replace(/\/$/, "")}/uploads/cards/${fileName}`;
}
