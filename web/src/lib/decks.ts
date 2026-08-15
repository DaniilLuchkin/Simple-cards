import type { Card, Deck, DeckFilter } from "./api";

// Deck selection is expressed the same way everywhere - in the chip row, in
// component props and on the wire: undefined = every card, "none" = the general
// deck (Card.deckId === null), anything else = that deck's id.

/** Filter a loaded list of cards by a deck selection. */
export function inDeck(cards: Card[], deckId: DeckFilter): Card[] {
  if (!deckId) return cards;
  if (deckId === "none") return cards.filter((c) => c.deckId === null);
  return cards.filter((c) => c.deckId === deckId);
}

/** What to send the API: the general deck is "no deck", i.e. nothing. */
export function deckArg(deckId: string | undefined): string | undefined {
  return !deckId || deckId === "none" ? undefined : deckId;
}

/**
 * Card counts recomputed from the cards already in memory, so the chips stay
 * right after a move/create/delete without another round trip. Falls back to
 * the server's counts while the full list hasn't loaded.
 */
export function withCounts(decks: Deck[], cards: Card[] | null): Deck[] {
  if (!cards) return decks;
  return decks.map((d) => ({ ...d, cardCount: cards.filter((c) => c.deckId === d.id).length }));
}

export function generalCount(cards: Card[] | null, fallback: number): number {
  return cards ? cards.filter((c) => c.deckId === null).length : fallback;
}

const STUDY_KEY = "studyDeck";
const SAVE_KEY = "saveDeck";

/** The deck chosen on the review lobby; undefined (the default) = all cards. */
export function readStudyDeck(): DeckFilter {
  return localStorage.getItem(STUDY_KEY) || undefined;
}

export function writeStudyDeck(deckId: DeckFilter): void {
  localStorage.setItem(STUDY_KEY, deckId ?? "");
}

/** The deck last saved into; "none" (the default) = the general deck. */
export function readSaveDeck(): string {
  return localStorage.getItem(SAVE_KEY) || "none";
}

export function writeSaveDeck(deckId: string): void {
  localStorage.setItem(SAVE_KEY, deckId);
}
