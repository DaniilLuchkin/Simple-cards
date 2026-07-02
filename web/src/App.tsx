import { useEffect, useState } from "react";
import { api } from "./lib/api";
import type { Card } from "./lib/api";
import { usePrefs } from "./lib/prefs";
import { CardStack } from "./components/CardStack";
import { Library } from "./components/Library";
import { TabBar } from "./components/TabBar";
import type { Tab } from "./components/TabBar";

export function App() {
  const { t, theme, toggleTheme, lang, toggleLang } = usePrefs();
  const [tab, setTab] = useState<Tab>("review");
  const [dueCards, setDueCards] = useState<Card[] | null>(null);
  const [allCards, setAllCards] = useState<Card[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .getDueCards()
      .then((res) => setDueCards(res.cards))
      .catch((err) => setError(String(err)));
  }, []);

  useEffect(() => {
    if (tab === "library" && allCards === null) {
      api
        .getAllCards()
        .then((res) => setAllCards(res.cards))
        .catch((err) => setError(String(err)));
    }
  }, [tab, allCards]);

  function handleConsumed(card: Card) {
    setDueCards((prev) => (prev ? prev.filter((c) => c.id !== card.id) : prev));
  }

  function handleCardUpdated(card: Card) {
    setDueCards((prev) => prev?.map((c) => (c.id === card.id ? card : c)) ?? prev);
    setAllCards((prev) => prev?.map((c) => (c.id === card.id ? card : c)) ?? prev);
  }

  function handleCardDeleted(id: string) {
    setDueCards((prev) => prev?.filter((c) => c.id !== id) ?? prev);
    setAllCards((prev) => prev?.filter((c) => c.id !== id) ?? prev);
  }

  return (
    <div className="mx-auto flex h-screen max-w-md flex-col px-4 pt-[max(env(safe-area-inset-top),1rem)]">
      <header className="relative flex items-center justify-center py-3">
        <h1 className="text-xl font-semibold text-ink">Simple Cards</h1>
        <div className="absolute right-0 flex gap-1.5">
          <button
            type="button"
            onClick={toggleTheme}
            aria-label="Toggle theme"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-sky/40 text-sm dark:bg-sky/20"
          >
            {theme === "dark" ? "☀️" : "🌙"}
          </button>
          <button
            type="button"
            onClick={toggleLang}
            aria-label="Switch language"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-sky/40 text-xs font-semibold text-ink dark:bg-sky/20"
          >
            {lang === "ru" ? "RU" : "EN"}
          </button>
        </div>
      </header>

      <TabBar tab={tab} onChange={setTab} />

      <main className="min-h-0 flex-1 pb-[max(env(safe-area-inset-bottom),0.5rem)]">
        {error && <p className="p-4 text-center text-sm text-red-400">{error}</p>}

        {!error && tab === "review" && (
          dueCards === null ? (
            <p className="p-8 text-center text-sm text-muted">{t("loading")}</p>
          ) : (
            <CardStack
              cards={dueCards}
              onConsumed={handleConsumed}
              onCardUpdated={handleCardUpdated}
              onCardDeleted={handleCardDeleted}
            />
          )
        )}

        {!error && tab === "library" && (
          allCards === null ? (
            <p className="p-8 text-center text-sm text-muted">{t("loading")}</p>
          ) : (
            <Library cards={allCards} onCardUpdated={handleCardUpdated} onCardDeleted={handleCardDeleted} />
          )
        )}
      </main>
    </div>
  );
}
