import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { getTelegramWebApp } from "./telegram";
import { BASE_DICT, DICTS, RTL_LANGS } from "./i18n";
import type { StringKey } from "./i18n";

export type Theme = "light" | "dark";

type Prefs = {
  theme: Theme;
  uiLang: string;
  toggleTheme: () => void;
  setUiLang: (lang: string) => void;
  t: (key: StringKey) => string;
};

const PrefsContext = createContext<Prefs | null>(null);

export function PrefsProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem("theme");
    if (saved === "light" || saved === "dark") return saved;
    return getTelegramWebApp()?.colorScheme === "dark" ? "dark" : "light";
  });
  const [uiLang, setUiLangState] = useState<string>(() => {
    const saved = localStorage.getItem("uiLang");
    if (saved && DICTS[saved]) return saved;
    // Fall back to the old ru/en toggle value if present, else Russian.
    const legacy = localStorage.getItem("lang");
    return legacy && DICTS[legacy] ? legacy : "ru";
  });

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    localStorage.setItem("theme", theme);
    const bg = theme === "dark" ? "#3c3d44" : "#eae3f7";
    const webApp = getTelegramWebApp();
    webApp?.setBackgroundColor(bg);
    webApp?.setHeaderColor(bg);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem("uiLang", uiLang);
    document.documentElement.lang = uiLang;
    document.documentElement.dir = RTL_LANGS.has(uiLang) ? "rtl" : "ltr";
  }, [uiLang]);

  const dict = DICTS[uiLang] ?? BASE_DICT;

  const prefs: Prefs = {
    theme,
    uiLang,
    toggleTheme: () => setTheme((v) => (v === "dark" ? "light" : "dark")),
    setUiLang: setUiLangState,
    // Per-key fallback to English so partial translations never show blanks.
    t: (key) => dict[key] ?? BASE_DICT[key],
  };

  return <PrefsContext.Provider value={prefs}>{children}</PrefsContext.Provider>;
}

export function usePrefs(): Prefs {
  const prefs = useContext(PrefsContext);
  if (!prefs) throw new Error("usePrefs must be used inside PrefsProvider");
  return prefs;
}
