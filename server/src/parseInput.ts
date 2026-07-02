/**
 * Splits user input into a word/phrase and an optional example sentence.
 * - "word" -> { word: "word" }
 * - "word\nThis is an example sentence." -> { word, example }
 * - "word - This is an example sentence." -> { word, example }
 */
export function parseWordInput(text: string): { word: string; example?: string } {
  const trimmed = text.trim();

  const newlineIdx = trimmed.indexOf("\n");
  if (newlineIdx !== -1) {
    const word = trimmed.slice(0, newlineIdx).trim();
    const example = trimmed.slice(newlineIdx + 1).trim();
    return example ? { word, example } : { word };
  }

  const dashMatch = trimmed.match(/^(.+?)\s+[-–—]\s+(.+)$/);
  if (dashMatch) {
    return { word: dashMatch[1].trim(), example: dashMatch[2].trim() };
  }

  return { word: trimmed };
}
