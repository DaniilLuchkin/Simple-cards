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

// Saves a card image under UPLOADS_DIR and returns the relative path it is
// served from. Only the path is stored in the DB - the origin is prepended at
// read time (absoluteImageUrl), so cards survive domain changes.
export async function saveImage(buffer: Buffer, contentType: string): Promise<string> {
  const fileName = `${randomUUID()}.${EXT_BY_CONTENT_TYPE[contentType] ?? "jpg"}`;
  const dir = path.join(env.UPLOADS_DIR, "cards");
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, fileName), buffer);
  return `/uploads/cards/${fileName}`;
}

// Builds the public URL for a stored image path. Also accepts legacy rows
// where a full URL was stored: their path is re-anchored to the current
// PUBLIC_ORIGIN, so cards created before a domain change keep working.
export function absoluteImageUrl(stored: string | null): string | null {
  if (!stored) return null;
  const pathname = stored.startsWith("http") ? new URL(stored).pathname : stored;
  return `${env.PUBLIC_ORIGIN}${pathname}`;
}
