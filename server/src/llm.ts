import { env } from "./env.js";
import type { Languages } from "./languages.js";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

type ChatContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

type ChatMessage = {
  role: "system" | "user";
  content: string | ChatContentPart[];
};

export type GeneratedCardFields = {
  word: string;
  example: string;
  explanation: string;
  translation: string;
};

function cardSystemPrompt({ learning, translation }: Languages): string {
  return `You are a card-writing assistant for "Simple Cards", a Telegram mini app for learning ${learning} vocabulary.
Given a word or phrase (and optionally a user-provided example sentence and/or an image), produce a flashcard.

Rules:
- "word": the canonical ${learning} word/phrase, cleaned up (fix obvious typos, keep user's intended word). If the user typed it in another language, translate it to ${learning}.
- "example": one natural example sentence in ${learning} using the word. If the user provided their own example, reuse it (lightly fixed for grammar) instead of writing a new one.
- "explanation": an explanation of the word's meaning written in SIMPLE ${learning} (beginner level, short sentences, no rare words), as if explaining to a learner. Do not just repeat the word.
- "translation": an accurate ${translation} translation of the word/phrase (a short translation, not a sentence).

Respond ONLY with a JSON object: {"word": string, "example": string, "explanation": string, "translation": string}`;
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

function imageSystemPrompt({ learning, translation }: Languages): string {
  return `You are a card-writing assistant for "Simple Cards", a Telegram mini app for learning ${learning} vocabulary.
The user sent a photo without any text. Identify the single most prominent object, action or concept in the photo.

- If you can identify it confidently (a clear everyday object like headphones, a cup, a dog), produce a flashcard for its common ${learning} name following these rules:
  - "word": the common ${learning} word for what's in the photo.
  - "example": one natural example sentence in ${learning} using the word.
  - "explanation": the word's meaning in SIMPLE ${learning} (beginner level, short sentences, no rare words). Do not just repeat the word.
  - "translation": an accurate ${translation} translation of the word (short, not a sentence).
  Respond: {"recognized": true, "word": string, "example": string, "explanation": string, "translation": string}
- If the photo is ambiguous, abstract, or could reasonably be named many different ways, respond: {"recognized": false}

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

function wordOfDayPrompt({ learning, translation }: Languages): string {
  return `You are the "word of the day" picker for "Simple Cards", a Telegram app for people learning ${learning} vocabulary. The user is NOT a beginner - they want to expand an already-decent vocabulary.

Pick ONE genuinely useful but non-obvious ${learning} word or idiomatic expression at UPPER-INTERMEDIATE to ADVANCED level (roughly CEFR B2-C1). It should be a word an educated native speaker uses naturally, but that an intermediate learner likely does NOT know yet.

Hard rules:
- NEVER pick basic A1-B1 vocabulary. For English, words like "reliable", "keys", "backpack", "headphones", "commute", "happy", "important", "decide", "travel" are TOO SIMPLE - reject anything at that level.
- Prefer precise, expressive, or idiomatic words: e.g. for English "meticulous", "underrated", "cope with", "resilient", "blatant", "tedious", "overwhelmed", "get the hang of", "far-fetched", "cut corners". Aim at that level of sophistication.
- Not obscure literary or academic jargon nobody says out loud either. It must be useful in real conversation, work, or media.
- Vary the part of speech, register, and topic strongly from day to day (include phrasal verbs and idioms sometimes, not only single adjectives).

You are given a list of words the user already has - do NOT pick any of them or their close forms, and avoid anything at a similar or lower difficulty than the simplest ones there.

For the picked word produce flashcard fields following these rules:
- "word": the ${learning} word/expression itself.
- "example": one natural example sentence in ${learning} using it.
- "explanation": its meaning in SIMPLE ${learning} (beginner level, short sentences, no rare words). Do not just repeat the word.
- "translation": an accurate ${translation} translation (short, not a sentence).

Respond ONLY with a JSON object: {"word": string, "example": string, "explanation": string, "translation": string}`;
}

export async function generateWordOfDay(
  existingWords: string[],
  languages: Languages
): Promise<GeneratedCardFields> {
  const content = await chatCompletion(
    [
      { role: "system", content: wordOfDayPrompt(languages) },
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

export async function regenerateCard(input: {
  word: string;
  previous: GeneratedCardFields;
  userComment: string;
  languages: Languages;
}): Promise<GeneratedCardFields> {
  const content = await chatCompletion([
    { role: "system", content: cardSystemPrompt(input.languages) },
    {
      role: "user",
      content: [
        `Word or phrase: ${input.word}`,
        `Previous card: ${JSON.stringify(input.previous)}`,
        `The user wants the card regenerated with this feedback: ${input.userComment}`,
        "Produce an improved card following the same rules and JSON format.",
      ].join("\n"),
    },
  ]);

  return parseGeneratedCard(content);
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

function parseGeneratedCard(raw: string): GeneratedCardFields {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`LLM did not return valid JSON: ${raw}`);
  }

  const obj = parsed as Partial<GeneratedCardFields>;
  if (!obj.word || !obj.example || !obj.explanation || !obj.translation) {
    throw new Error(`LLM JSON missing required fields: ${raw}`);
  }

  return {
    word: obj.word.trim(),
    example: obj.example.trim(),
    explanation: obj.explanation.trim(),
    translation: obj.translation.trim(),
  };
}
