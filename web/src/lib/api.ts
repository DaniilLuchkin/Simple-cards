import { getInitData } from "./telegram";

// Empty by default: in the combined single-service deployment the API is
// served from the same origin as this app, so relative paths just work.
// Set VITE_API_URL when running web/server as separate dev servers/services.
// Tolerates common paste mistakes (stray whitespace/quotes, missing scheme,
// trailing slash) - an invalid URL here makes every fetch throw a cryptic
// SyntaxError on WebKit.
const API_URL = (() => {
  const cleaned = (import.meta.env.VITE_API_URL ?? "").replace(/[\s"']+/g, "").replace(/\/+$/, "");
  if (!cleaned) return "";
  return /^https?:\/\//.test(cleaned) ? cleaned : `https://${cleaned}`;
})();

export type Card = {
  id: string;
  word: string;
  example: string;
  explanation: string;
  translation: string;
  imageUrl: string | null;
  // SM2 scheduling state - kept on the client so "undo last swipe" can send
  // the pre-review snapshot back to the server.
  easeFactor: number;
  interval: number;
  repetitions: number;
  dueAt: string;
  lastReviewedAt: string | null;
};

export type Sm2Snapshot = Pick<
  Card,
  "easeFactor" | "interval" | "repetitions" | "dueAt" | "lastReviewedAt"
>;

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "X-Telegram-Init-Data": getInitData(),
      ...init?.headers,
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ? JSON.stringify(body.error) : `Request failed: ${res.status}`);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  getDueCards: () => request<{ cards: Card[] }>("/api/cards/due"),
  getAllCards: () => request<{ cards: Card[] }>("/api/cards"),
  reviewCard: (id: string, quality: "remembered" | "forgot") =>
    request<{ card: Card }>(`/api/cards/${id}/review`, {
      method: "POST",
      body: JSON.stringify({ quality }),
    }),
  undoReview: (id: string, snapshot: Sm2Snapshot) =>
    request<{ card: Card }>(`/api/cards/${id}/review/undo`, {
      method: "POST",
      body: JSON.stringify(snapshot),
    }),
  deleteCard: (id: string) => request<void>(`/api/cards/${id}`, { method: "DELETE" }),
  regenerateCard: (id: string, comment: string) =>
    request<{ card: Card }>(`/api/cards/${id}/regenerate`, {
      method: "POST",
      body: JSON.stringify({ comment }),
    }),
  updateCard: (id: string, fields: Partial<Pick<Card, "word" | "example" | "explanation" | "translation">>) =>
    request<{ card: Card }>(`/api/cards/${id}`, {
      method: "PATCH",
      body: JSON.stringify(fields),
    }),
};
