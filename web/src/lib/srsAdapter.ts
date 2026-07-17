import type { Card } from "./api";
import { GAP_TOKEN } from "./srsCard";
import type { SrsCard } from "./srsCard";

// Turns a "meaning" of one word into a cloze by gapping the first occurrence of
// the headword — used for legacy cards that have no stored `sentence`.
function deriveCloze(example: string, headword: string): string {
  const re = new RegExp(`\\b${headword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
  return re.test(example) ? example.replace(re, GAP_TOKEN) : example;
}

// Maps an API card onto the SRS card view model. `translation` is the primary
// meaning (native language); `explanation` is the secondary simpler gloss.
export function toSrsCard(card: Card): SrsCard {
  return {
    id: card.id,
    headword: card.word,
    ipa: card.ipa ?? "",
    pos: card.pos ?? "",
    forms: card.forms ?? [],
    meaning: card.translation,
    explanation: card.explanation,
    sentence: card.sentence ?? deriveCloze(card.example, card.word),
    collocations: card.collocations ?? [],
    imageUrl: card.imageUrl ?? undefined,
    personalNote: card.personalNote ?? "",
    srs: card.srs,
  };
}
