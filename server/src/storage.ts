import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { env } from "./env.js";

const EXT_BY_CONTENT_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

// Saves a card image under UPLOADS_DIR and returns the absolute URL it is
// served from. The URL is stored on the card and also passed to the LLM as
// image input, so it must be publicly reachable.
export async function saveImage(buffer: Buffer, contentType: string): Promise<string> {
  const fileName = `${randomUUID()}.${EXT_BY_CONTENT_TYPE[contentType] ?? "jpg"}`;
  const dir = path.join(env.UPLOADS_DIR, "cards");
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, fileName), buffer);
  return `${env.PUBLIC_ORIGIN}/uploads/cards/${fileName}`;
}
