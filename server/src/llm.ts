import { env } from "./env.js";
import type { Languages } from "./languages.js";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const GAP = "{{gap}}";

type ChatContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

type ChatMessage = {
  role: "system" | "user";
  content: string | ChatContentPart[];
};

export type GeneratedCardFields = {
  headword: string;
  ipa: string;
  pos: string; // in the translation language, e.g. "глагол"
  forms: string[];
  sentence: string; // cloze form containing {{gap}}
  explanation: string; // simple, learning language, ONE sense
  translation: string; // short, translation language, ONE sense
  collocations: string[];
};

const JSON_SHAPE =
  '{"headword": string, "ipa": string, "pos": string, "forms": string[], "sentence": string, "explanation": string, "translation": string, "collocations": string[]}';

function fieldRules({ learning, translation }: Languages): string {
  return `- "headword": the canonical ${learning} word/phrase, cleaned up. If the user typed it in another language, translate it to ${learning}.
- "ipa": IPA transcription of the headword in slashes (e.g. "/ˈdrɪz.əl/"). Empty string if you are unsure.
- "pos": part of speech written in ${translation} (e.g. the ${translation} word for "verb"/"noun"/"adjective").
- "forms": 1-3 key inflected forms of the headword in ${learning} (e.g. ["drizzled", "drizzling"]). Empty array if not applicable.
- "sentence": ONE natural example sentence in ${learning} using the word, but with the target word replaced by the literal token ${GAP}. Keep the rest of the sentence natural. Reuse the user's example (lightly fixed) if they gave one.
- "explanation": the meaning in SIMPLE ${learning} (beginner level, short sentences). ONE sense only. Do not just repeat the word.
- "translation": the 1-3 most common ${translation} equivalents OF THE SINGLE SENSE you chose, comma-separated, most common first (e.g. for "maintain" in the upkeep sense: "обслуживать, поддерживать в хорошем состоянии"). Give more than one only when they are genuinely interchangeable synonyms a learner would recognise; one is fine when the word has a single natural equivalent. Never pad the list.
- "collocations": 2-3 frequent ${learning} collocations or set phrases with the word.

Minimum-information principle: pick ONE sense of the word and describe only that sense.
- SYNONYMS of that one sense belong together in "translation" - a learner may hold the word under any of them, so listing them prevents false failures.
- DIFFERENT senses must never share a card ("maintain" = keep in good condition vs = assert). If the word has several senses, pick the single most useful one and ignore the rest.
- Never use ";" or "/" in "translation": those read as separate senses. Commas separate synonyms only.`;
}

// Self-assessed CEFR level + goal, used to aim vocabulary difficulty.
export type Levels = { current: string; target: string };

// A sentence appended to generation prompts so the model picks vocabulary at the
// learner's band. Empty when no levels are set (keeps the old behaviour).
function levelGuidance(levels?: Levels): string {
  if (!levels) return "";
  return `\n\nThe learner self-assesses as CEFR ${levels.current} and is aiming for ${levels.target}. Choose vocabulary at the appropriate next step for them: useful and challenging but learnable from ${levels.current}, trending toward ${levels.target}. Avoid words well below ${levels.current} (too easy) or well above ${levels.target} (too hard).`;
}

function cardSystemPrompt(langs: Languages): string {
  return `You are a flashcard writer for "Simple Cards", a Telegram app for learning ${langs.learning} vocabulary with spaced repetition.
Produce ONE flashcard as a JSON object with these fields:
${fieldRules(langs)}

Respond ONLY with the JSON object: ${JSON_SHAPE}`;
}

export async function generateCard(input: {
  word: string;
  userExample?: string;
  imageUrl?: string;
  languages: Languages;
}): Promise<GeneratedCardFields> {
  const userParts: ChatContentPart[] = [
    {
      type: "text",
      text: [
        `Word or phrase: ${input.word}`,
        input.userExample ? `User's example sentence: ${input.userExample}` : null,
      ]
        .filter(Boolean)
        .join("\n"),
    },
  ];

  if (input.imageUrl) {
    userParts.push({ type: "image_url", image_url: { url: input.imageUrl } });
  }

  const content = await chatCompletion([
    { role: "system", content: cardSystemPrompt(input.languages) },
    { role: "user", content: userParts },
  ]);

  return parseGeneratedCard(content);
}

function imageSystemPrompt(langs: Languages): string {
  return `You are a flashcard writer for "Simple Cards", a Telegram app for learning ${langs.learning} vocabulary.
The user sent a photo without text. Identify the single most prominent object, action or concept.

- If you can name it confidently (a clear everyday object like headphones, a cup, a dog), produce a flashcard for its common ${langs.learning} name with these fields:
${fieldRules(langs)}
  Respond: {"recognized": true, ...the fields above...}
- If the photo is ambiguous or could be named many ways, respond: {"recognized": false}

Respond ONLY with the JSON object.`;
}

// Returns null when the model can't confidently name what's in the photo.
export async function generateCardFromImage(
  imageUrl: string,
  languages: Languages
): Promise<GeneratedCardFields | null> {
  const content = await chatCompletion([
    { role: "system", content: imageSystemPrompt(languages) },
    {
      role: "user",
      content: [
        { type: "text", text: "What is in this photo? Make a flashcard if it's obvious." },
        { type: "image_url", image_url: { url: imageUrl } },
      ],
    },
  ]);

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error(`LLM did not return valid JSON: ${content}`);
  }
  if (!(parsed as { recognized?: boolean }).recognized) return null;
  return parseGeneratedCard(content);
}

function wordOfDayPrompt(langs: Languages, levels?: Levels): string {
  const band = levels
    ? `at the right level for a CEFR ${levels.current} learner aiming for ${levels.target} - challenging but learnable, trending toward ${levels.target}`
    : "at UPPER-INTERMEDIATE to ADVANCED level (roughly CEFR B2-C1) - a word an educated native uses naturally but an intermediate learner likely doesn't know yet. NEVER pick basic A1-B1 vocabulary";
  return `You are the "word of the day" picker for "Simple Cards", a Telegram app for people learning ${langs.learning} vocabulary.

Pick ONE genuinely useful but non-obvious ${langs.learning} word or idiomatic expression ${band}. Prefer precise/expressive/idiomatic words (adjectives, phrasal verbs, idioms). Not obscure academic jargon. Vary part of speech and topic day to day. Do NOT pick any word in the given "already has" list or its close forms.

Then produce a flashcard for the picked word as a JSON object:
${fieldRules(langs)}

Respond ONLY with the JSON object: ${JSON_SHAPE}`;
}

export async function generateWordOfDay(
  existingWords: string[],
  languages: Languages,
  levels?: Levels
): Promise<GeneratedCardFields> {
  const content = await chatCompletion(
    [
      { role: "system", content: wordOfDayPrompt(languages, levels) },
      {
        role: "user",
        content: existingWords.length
          ? `Words the user already has (do not pick these): ${existingWords.join(", ")}`
          : "The user has no cards yet - pick a great first word.",
      },
    ],
    { temperature: 0.9 }
  );

  return parseGeneratedCard(content);
}

function cardSetPrompt(langs: Languages, max: number, levels?: Levels): string {
  return `You are a vocabulary curator for "Simple Cards", an app for learning ${langs.learning} vocabulary. The user describes a set of flashcards they want in natural language — a topic, exam, situation, or level, and possibly a number of cards.

Choose genuinely useful, real ${langs.learning} words or phrases that best match the request (varied, non-duplicate, no near-duplicates of each other).

If the request CONTAINS AN EXPLICIT LIST of words or phrases (one per line, or comma-separated), make exactly ONE card per listed item, in the order given - the list itself is the requested number, so do not fall back to a default count and do not silently drop entries. When an entry is a pair like "simple wording - better wording" (the right side may offer "/" alternatives), the card teaches the RIGHT-hand expression: that is what the learner wants to acquire, while the left side is the plain wording it replaces and is useful context for the meaning.

Otherwise honor the requested number of cards if one is given, and pick about 10 when none is. NEVER produce more than ${max} cards. Do NOT include any word from the user's "already has" list.${levelGuidance(levels)}

For EACH chosen word produce a flashcard object with these fields:
${fieldRules(langs)}

Respond ONLY with a JSON object: {"cards": [${JSON_SHAPE}, ...]}`;
}

// Generates a themed batch of flashcards from a free-text request.
export async function generateCardSet(
  request: string,
  languages: Languages,
  existingWords: string[],
  max: number,
  levels?: Levels
): Promise<GeneratedCardFields[]> {
  const content = await chatCompletion(
    [
      { role: "system", content: cardSetPrompt(languages, max, levels) },
      {
        role: "user",
        content: [
          `Request: ${request}`,
          existingWords.length ? `Already has (do not repeat): ${existingWords.join(", ")}` : null,
        ]
          .filter(Boolean)
          .join("\n"),
      },
    ],
    { temperature: 0.7 }
  );

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error(`LLM did not return valid JSON: ${content}`);
  }
  const rawCards = (parsed as { cards?: unknown }).cards;
  if (!Array.isArray(rawCards)) throw new Error(`LLM response had no cards array: ${content}`);

  return rawCards
    .map(coerceFields)
    .filter((c): c is GeneratedCardFields => c !== null)
    .slice(0, max);
}

// ---------- Grammar exercises ----------

export type GrammarExercise =
  | {
      type: "gap";
      /** Contains the {{gap}} token in place of the missing word. */
      sentence: string;
      options: string[];
      answer: string;
      /** One line shown straight away. */
      explanation: string;
      /** The full rule, revealed when the learner taps the explanation. */
      details: string;
    }
  | {
      type: "order";
      /**
       * Shuffled display tokens of `answer`: sentence-final punctuation and the
       * leading capital are removed so the chips don't give away which word
       * starts and which ends the sentence.
       */
      words: string[];
      answer: string;
      explanation: string;
      details: string;
    };

function grammarPrompt(langs: Languages, levels: Levels, count: number): string {
  return `You are a grammar-exercise writer for "Simple Cards", an app for learning ${langs.learning}.

Produce ${count} short exercises, MIXING these two types roughly evenly:
- {"type":"gap", "sentence": a natural ${langs.learning} sentence with ONE word replaced by the literal token ${GAP}, "answer": the word that belongs in the gap, "options": 4 plausible choices INCLUDING the answer (the wrong ones must be grammatically tempting, e.g. a wrong tense/article/preposition), "explanation": ..., "details": ...}
- {"type":"order", "answer": one natural ${langs.learning} sentence of 4-9 words, "explanation": ..., "details": ...}

Both types carry two levels of feedback, BOTH written in ${langs.translation}:
- "explanation": ONE short line - the rule in a nutshell.
- "details": 2-4 sentences the learner can open for more. Name the rule, say why the tempting wrong answers are wrong (for a gap) or what fixes the word order (for an order task), and finish with one more short ${langs.learning} example sentence showing the same rule. Do not merely repeat "explanation".

Each exercise must test a GRAMMAR point (tense, article, preposition, agreement, word order), not just vocabulary.${levelGuidance(levels)}

Where it fits naturally, build sentences around the learner's own words listed by the user - but never force a word in.

Respond ONLY with the JSON object: {"exercises": [...]}`;
}

// Fisher-Yates; the model's own ordering is never trusted.
function shuffled<T>(items: T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

const strings = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").map((x) => x.trim()).filter(Boolean) : [];

/** Whitespace-normalised word tokens of a sentence. */
export function sentenceTokens(sentence: string): string[] {
  return sentence.trim().split(/\s+/).filter(Boolean);
}

/**
 * Tokens to SHOW in a word-order task. A trailing "." marks the last word and a
 * leading capital marks the first, which hands the learner both ends of the
 * sentence for free - so both cues are stripped.
 *
 * A capital is kept when the token is capitalised mid-sentence anyway (a proper
 * noun) or is the English pronoun "I". The answer check is case- and
 * punctuation-insensitive, so an over-eager lowercase never costs a point.
 */
export function displayTokens(answer: string): string[] {
  const raw = sentenceTokens(answer);
  const properNouns = new Set(
    raw.slice(1).filter((t) => /^\p{Lu}/u.test(t)).map((t) => t.toLowerCase())
  );

  return raw.map((token, i) => {
    const bare = token.replace(/[.!?…]+$/u, "");
    if (i !== 0) return bare;
    if (/^I(['’]|$)/.test(bare)) return bare; // English "I", "I'm", "I've"…
    if (properNouns.has(bare.toLowerCase())) return bare;
    return bare.charAt(0).toLowerCase() + bare.slice(1);
  });
}

// Turns one raw LLM item into a usable exercise, or null when it's malformed.
// Everything the UI relies on is rebuilt here rather than taken on trust.
function coerceExercise(raw: unknown): GrammarExercise | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const explanation = typeof o.explanation === "string" ? o.explanation.trim() : "";
  const details = typeof o.details === "string" ? o.details.trim() : "";
  const answer = typeof o.answer === "string" ? o.answer.trim() : "";
  if (!answer) return null;

  if (o.type === "gap") {
    const sentence = typeof o.sentence === "string" ? o.sentence.trim() : "";
    if (!sentence.includes(GAP)) return null;

    // De-dupe, guarantee the answer is present, and shuffle so its position
    // carries no information.
    const options = [...new Set([answer, ...strings(o.options)])];
    if (options.length < 2) return null;

    return {
      type: "gap",
      sentence,
      options: shuffled(options.slice(0, 4)),
      answer,
      explanation,
      details,
    };
  }

  if (o.type === "order") {
    // Tokens come from the answer itself: a model-supplied word list routinely
    // disagrees with its own sentence, which would make the exercise unsolvable.
    const tokens = displayTokens(answer);
    if (tokens.length < 3) return null;

    return { type: "order", words: shuffled(tokens), answer, explanation, details };
  }

  return null;
}

export async function generateGrammarSet(
  languages: Languages,
  levels: Levels,
  words: string[],
  count: number
): Promise<GrammarExercise[]> {
  const content = await chatCompletion(
    [
      { role: "system", content: grammarPrompt(languages, levels, count) },
      {
        role: "user",
        content: words.length
          ? `The learner's words: ${words.slice(0, 60).join(", ")}`
          : "The learner has no cards yet - use common everyday vocabulary.",
      },
    ],
    { temperature: 0.8 }
  );

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error(`LLM did not return valid JSON: ${content}`);
  }
  const rawList = (parsed as { exercises?: unknown }).exercises;
  if (!Array.isArray(rawList)) throw new Error(`LLM response had no exercises array: ${content}`);

  return rawList
    .map(coerceExercise)
    .filter((e): e is GrammarExercise => e !== null)
    .slice(0, count);
}

export async function regenerateCard(input: {
  headword: string;
  previous: GeneratedCardFields;
  userComment?: string;
  languages: Languages;
}): Promise<GeneratedCardFields> {
  const comment = input.userComment?.trim();
  const instruction = comment
    ? `The user wants the card regenerated with this feedback: ${comment}`
    : "Regenerate this card: produce a fresh alternative for the same word with a different example sentence and phrasing.";
  const content = await chatCompletion([
    { role: "system", content: cardSystemPrompt(input.languages) },
    {
      role: "user",
      content: [
        `Word or phrase: ${input.headword}`,
        `Previous card: ${JSON.stringify(input.previous)}`,
        instruction,
        "Produce an improved card following the same rules and JSON format.",
      ].join("\n"),
    },
  ]);

  return parseGeneratedCard(content);
}

// Generates a card illustration via an image-capable OpenRouter model. The model
// returns the image inline as a base64 data URL in the assistant message.
export async function generateImage(prompt: string): Promise<{ buffer: Buffer; contentType: string }> {
  const res = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": env.MINI_APP_URL,
      "X-Title": env.OPENROUTER_APP_NAME,
    },
    body: JSON.stringify({
      model: env.OPENROUTER_IMAGE_MODEL,
      messages: [{ role: "user", content: prompt }],
      modalities: ["image", "text"],
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`OpenRouter image request failed: ${res.status} ${body}`);
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { images?: Array<{ image_url?: { url?: string } }> } }>;
  };
  const url = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
  if (!url || !url.startsWith("data:")) {
    throw new Error("OpenRouter response had no image");
  }
  const [meta, b64] = url.split(",", 2);
  const contentType = meta.match(/^data:(.*?);base64$/)?.[1] ?? "image/png";
  return { buffer: Buffer.from(b64, "base64"), contentType };
}

// Plain text translation for the in-app translator.
export async function translateText(text: string, fromName: string, toName: string): Promise<string> {
  const content = await chatCompletion(
    [
      {
        role: "system",
        content: `You are a translator. Translate the user's text from ${fromName} to ${toName}. Give the most natural everyday translation. Respond ONLY with JSON: {"translation": "..."} — no notes, no alternatives.`,
      },
      { role: "user", content: text },
    ],
    { temperature: 0 }
  );
  try {
    const obj = JSON.parse(content) as { translation?: string };
    return String(obj.translation ?? "").trim();
  } catch {
    return content.trim();
  }
}

async function chatCompletion(messages: ChatMessage[], opts?: { temperature?: number }): Promise<string> {
  const res = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": env.MINI_APP_URL,
      "X-Title": env.OPENROUTER_APP_NAME,
    },
    body: JSON.stringify({
      model: env.OPENROUTER_MODEL,
      messages,
      response_format: { type: "json_object" },
      temperature: opts?.temperature ?? 0.4,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`OpenRouter request failed: ${res.status} ${body}`);
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("OpenRouter response had no content");
  return content;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((v) => String(v).trim()).filter(Boolean);
}

// Ensures the sentence carries the {{gap}} cloze token. If the model forgot it
// but the headword appears in the sentence, gap that occurrence.
function ensureCloze(sentence: string, headword: string): string {
  if (sentence.includes(GAP)) return sentence;
  const re = new RegExp(`\\b${headword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
  return sentence.replace(re, GAP);
}

// Coerces one parsed JSON object into card fields, or null if required fields
// are missing (used to defensively skip bad items in a batch).
function coerceFields(value: unknown): GeneratedCardFields | null {
  if (!value || typeof value !== "object") return null;
  const obj = value as Record<string, unknown>;
  const headword = String(obj.headword ?? obj.word ?? "").trim();
  const explanation = String(obj.explanation ?? "").trim();
  const translation = String(obj.translation ?? "").trim();
  const rawSentence = String(obj.sentence ?? obj.example ?? "").trim();

  if (!headword || !explanation || !translation || !rawSentence) return null;

  return {
    headword,
    ipa: String(obj.ipa ?? "").trim(),
    pos: String(obj.pos ?? "").trim(),
    forms: asStringArray(obj.forms),
    sentence: ensureCloze(rawSentence, headword),
    explanation,
    translation,
    collocations: asStringArray(obj.collocations).slice(0, 3),
  };
}

function parseGeneratedCard(raw: string): GeneratedCardFields {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`LLM did not return valid JSON: ${raw}`);
  }
  const fields = coerceFields(parsed);
  if (!fields) throw new Error(`LLM JSON missing required fields: ${raw}`);
  return fields;
}

// The plain sentence with the gap filled by the headword - kept in `example`
// for the library preview and backward compatibility.
export function filledSentence(fields: Pick<GeneratedCardFields, "sentence" | "headword">): string {
  return fields.sentence.split(GAP).join(fields.headword);
}
