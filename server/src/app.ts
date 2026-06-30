import cors from "cors";
import express from "express";
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

app.use("/api/cards", telegramAuth, cardsRouter);

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});
