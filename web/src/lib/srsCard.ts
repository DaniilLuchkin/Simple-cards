import type { SrsState } from "./srs";

// The cloze marker in `sentence` that gets replaced by the gap (front) or the
// headword (back).
export const GAP_TOKEN = "{{gap}}";

export type SrsCard = {
  id: string;
  headword: string; // "drizzle"
  ipa: string; // "/ˈdrɪz.əl/"
  pos: string; // part of speech, localized: "глагол"
  forms: string[]; // ["drizzled", "drizzling"]
  meaning: string; // ONE sense only (the native-language gloss)
  explanation?: string; // optional simpler same-language gloss, shown as secondary
  sentence: string; // contains GAP_TOKEN
  collocations: string[]; // 2-3 frequent collocations
  imageUrl?: string;
  icon?: string; // emoji fallback when there's no image
  audioUrl?: string; // falls back to SpeechSynthesis
  personalNote: string; // editable user association
  srs: SrsState;
};

// Minimum-information principle: one card = one fact. A card whose `meaning`
// smuggles several senses (";", " / ", multiple comma-separated glosses) should
// be split into separate cards instead. This validates that at creation time.
export function validateSrsCard(card: SrsCard): string[] {
  const errors: string[] = [];

  if (!card.sentence.includes(GAP_TOKEN)) {
    errors.push(`sentence must contain the ${GAP_TOKEN} cloze marker`);
  }
  if (!card.imageUrl && !card.icon) {
    // Dual coding: the image is a required second memory channel, not decor.
    errors.push("card must have an image or icon (dual coding)");
  }
  if (looksLikeMultipleSenses(card.meaning)) {
    errors.push(
      `meaning looks like multiple senses ("${card.meaning}") - split into separate cards (one fact per card)`
    );
  }

  return errors;
}

function looksLikeMultipleSenses(meaning: string): boolean {
  // A semicolon almost always separates distinct senses.
  if (meaning.includes(";")) return true;
  // " / " between short glosses (not a dash-explanation) also signals senses.
  if (/\s\/\s/.test(meaning)) return true;
  // Three or more comma-separated short fragments with no explanatory dash
  // reads as a synonym list of senses rather than one explained meaning.
  const hasExplanation = /[—–-]/.test(meaning);
  const fragments = meaning.split(",").map((s) => s.trim()).filter(Boolean);
  if (!hasExplanation && fragments.length >= 3) return true;

  return false;
}

/**
 * Retrieval scaffold for the cloze gap: the first letter of each word plus one
 * dot per remaining letter, e.g. "give up" -> "g··· ··". A blank alone can't be
 * reconstructed from context, while the skeleton makes a half-known word
 * retrievable without handing over the spelling. Non-letters (hyphens,
 * apostrophes) are kept so the shape of the word still reads.
 */
export function wordSkeleton(headword: string): string {
  return headword
    .split(/(\s+)/) // keep the separators so spacing survives
    .map((chunk) => {
      if (/^\s+$/.test(chunk) || !chunk) return chunk;
      let seenLetter = false;
      return [...chunk]
        .map((ch) => {
          if (!/\p{L}/u.test(ch)) return ch; // hyphen, apostrophe…
          if (!seenLetter) {
            seenLetter = true;
            return ch;
          }
          return "·";
        })
        .join("");
    })
    .join("");
}

/** Splits a `{{gap}}` sentence into the text before and after the gap. */
export function splitCloze(sentence: string): { before: string; after: string } {
  const idx = sentence.indexOf(GAP_TOKEN);
  if (idx === -1) return { before: sentence, after: "" };
  return {
    before: sentence.slice(0, idx),
    after: sentence.slice(idx + GAP_TOKEN.length),
  };
}
