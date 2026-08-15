import type { Card } from "./api";

/**
 * Comparable form of a word taken out of a sentence: lowercased, with
 * surrounding punctuation and quotes stripped. Inner hyphens and apostrophes
 * survive, so "well-known" and "don't" stay themselves.
 */
export function normalizeToken(token: string): string {
  return token
    .toLowerCase()
    .replace(/^[^\p{L}\p{N}]+/u, "")
    .replace(/[^\p{L}\p{N}]+$/u, "");
}

/**
 * Maps every form of the learner's vocabulary to its card, so a token lifted
 * from an exercise sentence can be looked up directly: "goes" finds the "go"
 * card through its `forms`, and "Spain." finds "Spain".
 *
 * Single tokens only - a multi-word headword ("give up") is deliberately left
 * unmatched rather than being found by a bare "give": showing the wrong card is
 * worse than showing none.
 */
export function buildWordIndex(cards: Card[]): Map<string, Card> {
  const index = new Map<string, Card>();

  for (const card of cards) {
    for (const variant of [card.word, ...(card.forms ?? [])]) {
      if (!variant || /\s/.test(variant.trim())) continue;
      const key = normalizeToken(variant);
      // First card wins, so an earlier (more recently created) card isn't
      // shadowed by a later one sharing an inflected form.
      if (key && !index.has(key)) index.set(key, card);
    }
  }

  return index;
}
