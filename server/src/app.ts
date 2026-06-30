import cors from "cors";
import express from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { env } from "./env.js";
import { telegramAuth } from "./middleware/telegramAuth.js";
import { cardsRouter } from "./api/routes/cards.js";

export const app = express();

app.use(express.json());
app.use(
  cors({
    origin: env.CORS_ORIGIN.split(",").map((o) => o.trim()),
  })
);

app.get("/health", (_req, res) => res.json({ ok: true }));

app.use("/uploads", express.static(env.UPLOADS_DIR));

app.use("/api/cards", telegramAuth, cardsRouter);

// Serves the built Mini App (web/dist) from the same process/origin when
// present, so a single Railway service can host the API, the bot and the
// frontend together. No-op for split server/web deployments where web/dist
// was never built next to this service.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webDistPath = path.join(__dirname, "../../web/dist");

if (fs.existsSync(webDistPath)) {
  app.use(express.static(webDistPath));
  app.get(/^\/(?!api|uploads).*/, (_req, res) => {
    res.sendFile(path.join(webDistPath, "index.html"));
  });
}

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});
