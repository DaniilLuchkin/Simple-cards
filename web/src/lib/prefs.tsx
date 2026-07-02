import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { getTelegramWebApp } from "./telegram";

export type Lang = "ru" | "en";
export type Theme = "light" | "dark";

const STRINGS = {
  ru: {
    tabReview: "Повторение",
    tabLibrary: "Мои карточки",
    loading: "Загрузка…",
    emptyTitle: "Карточек на повторение пока нет",
    emptyHint: "Пришли боту новое слово, картинку или загляни позже — карточки появятся по расписанию.",
    delete: "Удалить",
    regenerate: "Перегенерировать",
    remember: "Помню",
    forgot: "Забыл",
    tapFlip: "Нажми, чтобы перевернуть",
    tapBack: "Нажми ещё раз, чтобы вернуться",
    close: "Закрыть",
    edit: "Редактировать",
    cancel: "Отмена",
    save: "Сохранить",
    saving: "Сохраняю…",
    fieldWord: "Слово",
    fieldExample: "Пример",
    fieldExplanation: "Объяснение (простой English)",
    fieldTranslation: "Перевод",
    regenTitle: "Перегенерировать карточку",
    regenHint: "Опиши, что поправить — например «сделай пример проще» или «перевод неточный».",
    regenPlaceholder: "Твой комментарий…",
    generating: "Генерирую…",
    done: "Готово",
    libEmpty: "Карточек пока нет. Пришли слово боту, чтобы создать первую.",
    nextReview: "Повторение",
  },
  en: {
    tabReview: "Review",
    tabLibrary: "My cards",
    loading: "Loading…",
    emptyTitle: "No cards due right now",
    emptyHint: "Send the bot a new word or a photo, or come back later — cards show up on schedule.",
    delete: "Delete",
    regenerate: "Regenerate",
    remember: "Got it",
    forgot: "Forgot",
    tapFlip: "Tap to flip",
    tapBack: "Tap again to flip back",
    close: "Close",
    edit: "Edit",
    cancel: "Cancel",
    save: "Save",
    saving: "Saving…",
    fieldWord: "Word",
    fieldExample: "Example",
    fieldExplanation: "Explanation (simple English)",
    fieldTranslation: "Translation",
    regenTitle: "Regenerate card",
    regenHint: "Describe what to fix — e.g. “make the example simpler” or “the translation is off”.",
    regenPlaceholder: "Your comment…",
    generating: "Generating…",
    done: "Done",
    libEmpty: "No cards yet. Send the bot a word to create your first one.",
    nextReview: "Next review",
  },
} as const;

export type StringKey = keyof (typeof STRINGS)["ru"];

type Prefs = {
  theme: Theme;
  lang: Lang;
  toggleTheme: () => void;
  toggleLang: () => void;
  t: (key: StringKey) => string;
};

const PrefsContext = createContext<Prefs | null>(null);

export function PrefsProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem("theme");
    if (saved === "light" || saved === "dark") return saved;
    return getTelegramWebApp()?.colorScheme === "dark" ? "dark" : "light";
  });
  const [lang, setLang] = useState<Lang>(() => {
    const saved = localStorage.getItem("lang");
    return saved === "en" ? "en" : "ru";
  });

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    localStorage.setItem("theme", theme);
    const bg = theme === "dark" ? "#0e1522" : "#ffffff";
    const webApp = getTelegramWebApp();
    webApp?.setBackgroundColor(bg);
    webApp?.setHeaderColor(bg);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem("lang", lang);
  }, [lang]);

  const prefs: Prefs = {
    theme,
    lang,
    toggleTheme: () => setTheme((t) => (t === "dark" ? "light" : "dark")),
    toggleLang: () => setLang((l) => (l === "ru" ? "en" : "ru")),
    t: (key) => STRINGS[lang][key],
  };

  return <PrefsContext.Provider value={prefs}>{children}</PrefsContext.Provider>;
}

export function usePrefs(): Prefs {
  const prefs = useContext(PrefsContext);
  if (!prefs) throw new Error("usePrefs must be used inside PrefsProvider");
  return prefs;
}
