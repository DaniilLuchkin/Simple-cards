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

export type Grade = "again" | "hard" | "good" | "easy";

export type Card = {
  id: string;
  word: string; // == headword
  example: string; // filled sentence
  explanation: string;
  translation: string;
  imageUrl: string | null;
  // Rich SRS fields (may be null/empty on cards created before the extension).
  ipa: string | null;
  pos: string | null;
  forms: string[];
  collocations: string[];
  sentence: string | null; // cloze form with {{gap}}
  personalNote: string;
  // Nested scheduling state used by the SRS card + grade buttons.
  srs: { due: string; interval: number; ease: number; reps: number; lapses: number };
  // Flat SM2 state - kept on the client so "undo" can send the pre-review
  // snapshot back to the server.
  easeFactor: number;
  interval: number;
  repetitions: number;
  lapses: number;
  dueAt: string;
  lastReviewedAt: string | null;
};

export type Sm2Snapshot = Pick<
  Card,
  "easeFactor" | "interval" | "repetitions" | "lapses" | "dueAt" | "lastReviewedAt"
>;

export type Profile = {
  learningLanguage: string;
  translationLanguage: string;
  // null = not chosen yet (e.g. never touched /language in the bot); the
  // client's own local preference wins in that case.
  interfaceLanguage: string | null;
  dailyGoal: number;
  todayCount: number;
  streak: number;
  // { "2026-07-03": 12, ... }
  activity: Record<string, number>;
};

export type ProfileUpdate = Partial<
  Pick<Profile, "learningLanguage" | "translationLanguage" | "interfaceLanguage" | "dailyGoal">
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
  gradeCard: (id: string, grade: Grade) =>
    request<{ card: Card }>(`/api/cards/${id}/grade`, {
      method: "POST",
      body: JSON.stringify({ grade }),
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
  updateCard: (
    id: string,
    fields: Partial<
      Pick<
        Card,
        | "word"
        | "example"
        | "explanation"
        | "translation"
        | "personalNote"
        | "sentence"
        | "ipa"
        | "pos"
        | "forms"
        | "collocations"
      >
    >
  ) =>
    request<{ card: Card }>(`/api/cards/${id}`, {
      method: "PATCH",
      body: JSON.stringify(fields),
    }),
  // Uploads raw image bytes (not JSON), so it bypasses the request() helper to
  // set the file's own Content-Type.
  uploadCardImage: async (id: string, file: File): Promise<{ card: Card }> => {
    const res = await fetch(`${API_URL}/api/cards/${id}/image`, {
      method: "POST",
      headers: {
        "Content-Type": file.type || "image/jpeg",
        "X-Telegram-Init-Data": getInitData(),
      },
      body: file,
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error ? JSON.stringify(body.error) : `Upload failed: ${res.status}`);
    }
    return res.json() as Promise<{ card: Card }>;
  },
  getProfile: () => request<{ profile: Profile }>("/api/me"),
  updateProfile: (update: ProfileUpdate) =>
    request<{ profile: Profile }>("/api/me", {
      method: "PATCH",
      body: JSON.stringify(update),
    }),
};
