import { useEffect, useState } from "react";
import { api } from "./lib/api";
import type { Card, Profile as ProfileData, ProfileUpdate, Sm2Snapshot } from "./lib/api";
import { usePrefs } from "./lib/prefs";
import { CardStack } from "./components/CardStack";
import { Library } from "./components/Library";
import { Profile } from "./components/Profile";
import { TabBar } from "./components/TabBar";
import type { Tab } from "./components/TabBar";

function shuffle<T>(items: T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function sm2Snapshot(card: Card): Sm2Snapshot {
  return {
    easeFactor: card.easeFactor,
    interval: card.interval,
    repetitions: card.repetitions,
    dueAt: card.dueAt,
    lastReviewedAt: card.lastReviewedAt,
  };
}

type UndoInfo = { card: Card; snapshot: Sm2Snapshot; practice: boolean };

export function App() {
  const { theme, toggleTheme, t } = usePrefs();
  const [tab, setTab] = useState<Tab>("review");
  const [dueCards, setDueCards] = useState<Card[] | null>(null);
  const [allCards, setAllCards] = useState<Card[] | null>(null);
  const [practiceCards, setPracticeCards] = useState<Card[] | null>(null);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [undoInfo, setUndoInfo] = useState<UndoInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.getDueCards().then((res) => setDueCards(res.cards)).catch((err) => setError(String(err)));
  }, []);

  useEffect(() => {
    if (tab === "library" && allCards === null) {
      api.getAllCards().then((res) => setAllCards(res.cards)).catch((err) => setError(String(err)));
    }
    // Profile is refetched every time the tab opens so streak/today are fresh.
    if (tab === "profile") {
      api.getProfile().then((res) => setProfile(res.profile)).catch((err) => setError(String(err)));
    }
  }, [tab, allCards]);

  async function handleSwiped(card: Card, direction: "left" | "right") {
    if (practiceCards) {
      setPracticeCards((prev) => prev?.filter((c) => c.id !== card.id) ?? prev);
      setUndoInfo({ card, snapshot: sm2Snapshot(card), practice: true });
      return;
    }

    const snapshot = sm2Snapshot(card);
    setDueCards((prev) => prev?.filter((c) => c.id !== card.id) ?? prev);
    try {
      await api.reviewCard(card.id, direction === "right" ? "remembered" : "forgot");
      setUndoInfo({ card, snapshot, practice: false });
    } catch (err) {
      console.error("Failed to record review", err);
    }
  }

  async function handleUndo() {
    if (!undoInfo) return;
    const { card, snapshot, practice } = undoInfo;
    setUndoInfo(null);

    if (practice) {
      setPracticeCards((prev) => [card, ...(prev ?? [])]);
      return;
    }

    try {
      const { card: restored } = await api.undoReview(card.id, snapshot);
      setDueCards((prev) => [restored, ...(prev ?? [])]);
    } catch (err) {
      console.error("Failed to undo review", err);
    }
  }

  function startPractice() {
    api
      .getAllCards()
      .then((res) => {
        setAllCards(res.cards);
        setPracticeCards(shuffle(res.cards));
      })
      .catch((err) => setError(String(err)));
  }

  function handleUpdateProfile(update: ProfileUpdate) {
    setProfile((prev) => (prev ? { ...prev, ...update } : prev));
    api.updateProfile(update).then((res) => setProfile(res.profile)).catch((err) => setError(String(err)));
  }

  function handleCardUpdated(card: Card) {
    setDueCards((prev) => prev?.map((c) => (c.id === card.id ? card : c)) ?? prev);
    setAllCards((prev) => prev?.map((c) => (c.id === card.id ? card : c)) ?? prev);
    setPracticeCards((prev) => prev?.map((c) => (c.id === card.id ? card : c)) ?? prev);
  }

  function handleCardDeleted(id: string) {
    setDueCards((prev) => prev?.filter((c) => c.id !== id) ?? prev);
    setAllCards((prev) => prev?.filter((c) => c.id !== id) ?? prev);
    setPracticeCards((prev) => prev?.filter((c) => c.id !== id) ?? prev);
    setUndoInfo((prev) => (prev?.card.id === id ? null : prev));
  }

  const practice = practiceCards !== null;
  const reviewCards = practiceCards ?? dueCards;

  return (
    <div className="mx-auto flex h-screen max-w-md flex-col px-4 pt-[max(env(safe-area-inset-top),0.5rem)]">
      <header className="flex items-center justify-end py-1">
        <button
          type="button"
          onClick={toggleTheme}
          aria-label="Toggle theme"
          className="flex h-8 w-8 items-center justify-center rounded-full bg-sky/40 text-sm dark:bg-sky/20"
        >
          {theme === "dark" ? "☀️" : "🌙"}
        </button>
      </header>

      <TabBar tab={tab} onChange={setTab} />

      <main className="min-h-0 flex-1 pb-[max(env(safe-area-inset-bottom),0.5rem)]">
        {error && <p className="p-4 text-center text-sm text-red-400">{error}</p>}

        {!error && tab === "review" && (
          reviewCards === null ? (
            <p className="p-8 text-center text-sm text-muted">{t("loading")}</p>
          ) : (
            <CardStack
              cards={reviewCards}
              practice={practice}
              canUndo={undoInfo !== null}
              onUndo={handleUndo}
              onStartPractice={startPractice}
              onSwiped={handleSwiped}
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

        {!error && tab === "profile" && (
          profile === null ? (
            <p className="p-8 text-center text-sm text-muted">{t("loading")}</p>
          ) : (
            <Profile profile={profile} onUpdate={handleUpdateProfile} />
          )
        )}
      </main>
    </div>
  );
}
