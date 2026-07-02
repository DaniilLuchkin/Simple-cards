import { env } from "./env.js";

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

const SYSTEM_PROMPT = `You are a card-writing assistant for "Simple Cards", a Telegram mini app for learning English vocabulary.
Given a word or phrase (and optionally a user-provided example sentence and/or an image), produce a flashcard.

Rules:
- "word": the canonical English word/phrase, cleaned up (fix obvious typos, keep user's intended word).
- "example": one natural example sentence using the word. If the user provided their own example, reuse it (lightly fixed for grammar) instead of writing a new one.
- "explanation": an explanation of the word's meaning written in SIMPLE English (B1 level, short sentences, no rare words), as if explaining to a learner. Do not just repeat the word.
- "translation": an accurate Russian translation of the word/phrase (a short translation, not a sentence).

Respond ONLY with a JSON object: {"word": string, "example": string, "explanation": string, "translation": string}`;

export async function generateCard(input: {
  word: string;
  userExample?: string;
  imageUrl?: string;
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
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: userParts },
  ]);

  return parseGeneratedCard(content);
}

const IMAGE_SYSTEM_PROMPT = `You are a card-writing assistant for "Simple Cards", a Telegram mini app for learning English vocabulary.
The user sent a photo without any text. Identify the single most prominent object, action or concept in the photo.

- If you can identify it confidently (a clear everyday object like headphones, a cup, a dog), produce a flashcard for its common English name following these rules:
  - "word": the common English word for what's in the photo.
  - "example": one natural example sentence using the word.
  - "explanation": the word's meaning in SIMPLE English (B1 level, short sentences, no rare words). Do not just repeat the word.
  - "translation": an accurate Russian translation of the word (short, not a sentence).
  Respond: {"recognized": true, "word": string, "example": string, "explanation": string, "translation": string}
- If the photo is ambiguous, abstract, or could reasonably be named many different ways, respond: {"recognized": false}

Respond ONLY with the JSON object.`;

// Returns null when the model can't confidently name what's in the photo.
export async function generateCardFromImage(imageUrl: string): Promise<GeneratedCardFields | null> {
  const content = await chatCompletion([
    { role: "system", content: IMAGE_SYSTEM_PROMPT },
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

const WORD_OF_DAY_SYSTEM_PROMPT = `You are the "word of the day" picker for "Simple Cards", a Telegram app for Russian speakers learning English vocabulary.

Pick ONE genuinely useful English word or common expression (B1-C1 level): something a learner would actually use in conversation, work or travel. Not too basic (no "cat", "house"), not obscure academic jargon. Vary the part of speech and topic from day to day.

You are given a list of words the user already has - do NOT pick any of them or their close forms.

For the picked word produce flashcard fields following these rules:
- "word": the word/expression itself.
- "example": one natural example sentence using it.
- "explanation": its meaning in SIMPLE English (B1 level, short sentences, no rare words). Do not just repeat the word.
- "translation": an accurate Russian translation (short, not a sentence).

Respond ONLY with a JSON object: {"word": string, "example": string, "explanation": string, "translation": string}`;

export async function generateWordOfDay(existingWords: string[]): Promise<GeneratedCardFields> {
  const content = await chatCompletion(
    [
      { role: "system", content: WORD_OF_DAY_SYSTEM_PROMPT },
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
}): Promise<GeneratedCardFields> {
  const content = await chatCompletion([
    { role: "system", content: SYSTEM_PROMPT },
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
