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
  /** null = the general deck. */
  deckId: string | null;
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

// A named group of cards. The general deck is not one of these: cards with no
// deck belong to it, and the UI shows it as a built-in chip.
export type Deck = { id: string; name: string; cardCount: number };

/** Deck selection: undefined = every card, "none" = the general deck. */
export type DeckFilter = string | undefined;

export type Sm2Snapshot = Pick<
  Card,
  "easeFactor" | "interval" | "repetitions" | "lapses" | "dueAt" | "lastReviewedAt"
>;

// Raw generated card fields, produced server-side and echoed back verbatim when
// the user saves an AI-set preview.
export type GeneratedFields = {
  headword: string;
  ipa: string;
  pos: string;
  forms: string[];
  sentence: string;
  explanation: string;
  translation: string;
  collocations: string[];
};

// A generated-but-not-saved card shown in the AI tab for the user to keep or
// discard. `fields` + `imageUrl` are sent back on save.
export type CardPreview = {
  id: string;
  word: string;
  translation: string;
  example: string;
  imageUrl: string | null;
  fields: GeneratedFields;
};

// A daily quest, derived server-side from the day's play stats.
export type QuestId = "session" | "goal" | "combo" | "learn" | "twoSessions" | "half";
export type Quest = {
  id: QuestId;
  progress: number;
  target: number;
  done: boolean;
};

// A grammar drill. Generated fresh each run and never stored, so it carries no
// id: the client holds the batch for the length of the round.
export type GrammarExercise =
  | {
      type: "gap";
      /** Contains the {{gap}} token where the missing word goes. */
      sentence: string;
      options: string[];
      answer: string;
      /** One line shown straight away. */
      explanation: string;
      /** The full rule, revealed on tap. */
      details: string;
    }
  | {
      type: "order";
      /** Shuffled tokens of `answer`, stripped of first/last position cues. */
      words: string[];
      answer: string;
      explanation: string;
      details: string;
    };

// One row of the weekly friends leaderboard.
export type LeagueEntry = {
  name: string;
  count: number;
  isMe: boolean;
};

export type Profile = {
  learningLanguage: string;
  translationLanguage: string;
  // null = not chosen yet (e.g. never touched /language in the bot); the
  // client's own local preference wins in that case.
  interfaceLanguage: string | null;
  dailyGoal: number;
  // IANA timezone used for day boundaries (null = UTC / not detected yet).
  timezone: string | null;
  // Whether the daily word-of-the-day message is sent.
  wordOfDayEnabled: boolean;
  // Whether the daily streak reminder is sent.
  reminderEnabled: boolean;
  // CEFR self-assessed level and goal.
  currentLevel: string;
  targetLevel: string;
  // Cards mature enough to count as "learned".
  learnedCount: number;
  // Referral deep link (null when unknown) + how many friends this user invited.
  referralLink: string | null;
  referralCount: number;
  todayCount: number;
  streak: number;
  // Today's quests and the freezes banked from completing them.
  quests: Quest[];
  streakFreezes: number;
  // { "2026-07-03": 12, ... }
  activity: Record<string, number>;
};

export type ProfileUpdate = Partial<
  Pick<
    Profile,
    | "learningLanguage"
    | "translationLanguage"
    | "interfaceLanguage"
    | "dailyGoal"
    | "timezone"
    | "wordOfDayEnabled"
    | "reminderEnabled"
    | "currentLevel"
    | "targetLevel"
  >
>;

const deckQuery = (deckId?: DeckFilter) =>
  deckId ? `?deckId=${encodeURIComponent(deckId)}` : "";

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
  // deckId: undefined = every card, "none" = the general deck, else that deck.
  getDueCards: (deckId?: DeckFilter) =>
    request<{ cards: Card[] }>(`/api/cards/due${deckQuery(deckId)}`),
  getAllCards: (deckId?: DeckFilter) =>
    request<{ cards: Card[] }>(`/api/cards${deckQuery(deckId)}`),

  listDecks: () => request<{ decks: Deck[]; generalCount: number }>("/api/decks"),
  createDeck: (name: string) =>
    request<{ deck: Deck }>("/api/decks", { method: "POST", body: JSON.stringify({ name }) }),
  renameDeck: (id: string, name: string) =>
    request<{ ok: true }>(`/api/decks/${id}`, { method: "PATCH", body: JSON.stringify({ name }) }),
  // The deck's cards survive: they fall back to the general deck.
  deleteDeck: (id: string) => request<void>(`/api/decks/${id}`, { method: "DELETE" }),
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
  // File a batch of existing cards into a deck at once; null = the general deck.
  moveCards: (cardIds: string[], deckId: string | null) =>
    request<{ count: number }>("/api/cards/move", {
      method: "POST",
      body: JSON.stringify({ cardIds, deckId }),
    }),
  // Comment is optional - with none, the server regenerates a fresh alternative.
  regenerateCard: (id: string, comment?: string) =>
    request<{ card: Card }>(`/api/cards/${id}/regenerate`, {
      method: "POST",
      body: JSON.stringify(comment ? { comment } : {}),
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
        // Moving the card between decks; null returns it to the general deck.
        | "deckId"
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
  generateCardImage: (id: string) =>
    request<{ card: Card }>(`/api/cards/${id}/image/generate`, { method: "POST" }),
  // Creates a new card from a captured photo (raw image body, not JSON).
  createCardFromImage: async (file: File, deckId?: string): Promise<{ card: Card }> => {
    // The body is the image, so the deck travels as a query param.
    const res = await fetch(`${API_URL}/api/cards/from-image${deckId ? `?deckId=${deckId}` : ""}`, {
      method: "POST",
      headers: {
        "Content-Type": file.type || "image/jpeg",
        "X-Telegram-Init-Data": getInitData(),
      },
      body: file,
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error ? JSON.stringify(body.error) : `Request failed: ${res.status}`);
    }
    return res.json() as Promise<{ card: Card }>;
  },
  // Create a card from a word/phrase (e.g. from the translator).
  createCard: (word: string, example?: string, deckId?: string) =>
    request<{ card: Card }>("/api/cards", {
      method: "POST",
      body: JSON.stringify({ word, example, deckId }),
    }),
  translate: (text: string, from: string, to: string) =>
    request<{ translation: string }>("/api/translate", {
      method: "POST",
      body: JSON.stringify({ text, from, to }),
    }),
  // Generate a themed batch of card previews (each with an image) from a
  // natural-language request. Nothing is saved until saveCardSet.
  generateCardSet: (request_: string) =>
    request<{ previews: CardPreview[] }>("/api/cards/generate-set", {
      method: "POST",
      body: JSON.stringify({ request: request_ }),
    }),
  // Persist the previews the user chose to keep.
  saveCardSet: (
    cards: { fields: GeneratedFields; imageUrl: string | null }[],
    deckId?: string
  ) =>
    request<{ cards: Card[] }>("/api/cards/generate-set/save", {
      method: "POST",
      body: JSON.stringify({ cards, deckId }),
    }),
  getProfile: () => request<{ profile: Profile }>("/api/me"),
  getLeague: () => request<{ entries: LeagueEntry[] }>("/api/me/league"),
  // A fresh batch of grammar drills built from the learner's own words.
  getGrammarSet: () =>
    request<{ exercises: GrammarExercise[] }>("/api/grammar", { method: "POST" }),
  // Finish a review round; returns the refreshed profile (streak, quests…).
  completeSession: (bestCombo: number) =>
    request<{ profile: Profile }>("/api/me/session", {
      method: "POST",
      body: JSON.stringify({ bestCombo }),
    }),
  updateProfile: (update: ProfileUpdate) =>
    request<{ profile: Profile }>("/api/me", {
      method: "PATCH",
      body: JSON.stringify(update),
    }),
};
