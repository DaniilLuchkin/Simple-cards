import { getInitData } from "./telegram";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

export type Card = {
  id: string;
  word: string;
  example: string;
  explanation: string;
  translation: string;
  imageUrl: string | null;
  dueAt: string;
};

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
  deleteCard: (id: string) => request<void>(`/api/cards/${id}`, { method: "DELETE" }),
  regenerateCard: (id: string, comment: string) =>
    request<{ card: Card }>(`/api/cards/${id}/regenerate`, {
      method: "POST",
      body: JSON.stringify({ comment }),
    }),
};
