import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { getTelegramWebApp } from "./telegram";
import { BASE_DICT, DICTS, RTL_LANGS } from "./i18n";
import type { StringKey } from "./i18n";

export type Theme = "light" | "dark";

// Light-theme canvas colors the user can pick in Profile. Dark theme ignores
// these (it always uses the fixed slate defined in styles/index.css).
export type Palette = "lavender" | "mint" | "sky";
export const PALETTES: { id: Palette; hex: string }[] = [
  { id: "lavender", hex: "#eae3f7" },
  { id: "mint", hex: "#dcefe6" },
  { id: "sky", hex: "#dbe9fb" },
];
const PALETTE_HEX: Record<Palette, string> = {
  lavender: "#eae3f7",
  mint: "#dcefe6",
  sky: "#dbe9fb",
};

type Prefs = {
  theme: Theme;
  uiLang: string;
  palette: Palette;
  // What the card front shows as the prompt, so it's clear WHICH word is being
  // tested. Both default on; either can be turned off in Profile.
  frontTranslation: boolean;
  frontDefinition: boolean;
  toggleTheme: () => void;
  setUiLang: (lang: string) => void;
  setPalette: (palette: Palette) => void;
  setFrontTranslation: (on: boolean) => void;
  setFrontDefinition: (on: boolean) => void;
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
  const [palette, setPaletteState] = useState<Palette>(() => {
    const saved = localStorage.getItem("palette");
    return saved === "mint" || saved === "sky" ? saved : "lavender";
  });
  // Absent = on, so both prompts show until the user turns one off.
  const [frontTranslation, setFrontTranslationState] = useState(
    () => localStorage.getItem("frontTranslation") !== "0"
  );
  const [frontDefinition, setFrontDefinition] = useState(
    () => localStorage.getItem("frontDefinition") !== "0"
  );

  useEffect(() => {
    localStorage.setItem("frontTranslation", frontTranslation ? "1" : "0");
    localStorage.setItem("frontDefinition", frontDefinition ? "1" : "0");
  }, [frontTranslation, frontDefinition]);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    document.documentElement.dataset.palette = palette;
    localStorage.setItem("theme", theme);
    localStorage.setItem("palette", palette);
    // Match the Telegram chrome to the canvas: fixed slate in dark, the chosen
    // palette in light.
    const bg = theme === "dark" ? "#3c3d44" : PALETTE_HEX[palette];
    const webApp = getTelegramWebApp();
    webApp?.setBackgroundColor(bg);
    webApp?.setHeaderColor(bg);
  }, [theme, palette]);

  useEffect(() => {
    localStorage.setItem("uiLang", uiLang);
    document.documentElement.lang = uiLang;
    document.documentElement.dir = RTL_LANGS.has(uiLang) ? "rtl" : "ltr";
  }, [uiLang]);

  const dict = DICTS[uiLang] ?? BASE_DICT;

  const prefs: Prefs = {
    theme,
    uiLang,
    palette,
    frontTranslation,
    frontDefinition,
    toggleTheme: () => setTheme((v) => (v === "dark" ? "light" : "dark")),
    setUiLang: setUiLangState,
    setPalette: setPaletteState,
    setFrontTranslation: setFrontTranslationState,
    setFrontDefinition,
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
