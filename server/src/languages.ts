// Supported languages, keyed by the codes stored on the user. The English
// name is injected into LLM prompts; the web app has its own display names.
// Keep this list in sync with web/src/lib/prefs.tsx LANGUAGES.
export const LANGUAGE_NAMES: Record<string, string> = {
  en: "English",
  ru: "Russian",
  uk: "Ukrainian",
  es: "Spanish",
  de: "German",
  fr: "French",
  pt: "Portuguese",
  zh: "Chinese",
  hi: "Hindi",
  ar: "Arabic",
  fa: "Persian",
  tr: "Turkish",
  id: "Indonesian",
};

// Native display names, for the bot's /language picker. Keep in sync with
// web/src/lib/i18n.ts LANGUAGES.
export const LANGUAGE_NATIVE_NAMES: Record<string, string> = {
  en: "English",
  ru: "Русский",
  uk: "Українська",
  es: "Español",
  de: "Deutsch",
  fr: "Français",
  pt: "Português",
  tr: "Türkçe",
  id: "Bahasa Indonesia",
  zh: "中文",
  hi: "हिन्दी",
  ar: "العربية",
  fa: "فارسی",
};

export function languageName(code: string): string {
  return LANGUAGE_NAMES[code] ?? "English";
}

export type Languages = { learning: string; translation: string };

export function languageNames(codes: { learningLanguage: string; translationLanguage: string }): Languages {
  return {
    learning: languageName(codes.learningLanguage),
    translation: languageName(codes.translationLanguage),
  };
}
