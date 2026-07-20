import React from "react";
import ReactDOM from "react-dom/client";
import { PrefsProvider } from "./lib/prefs";
import { SrsCard } from "./components/srs/SrsCard";
import { Library } from "./components/Library";
import { Profile } from "./components/Profile";
import { TabBar } from "./components/TabBar";
import type { SrsCard as SrsCardData } from "./lib/srsCard";
import type { Card, Profile as ProfileData } from "./lib/api";
import "./styles/index.css";

const srs = { due: "2026-07-21T00:00:00Z", interval: 1, ease: 2.5, reps: 3, lapses: 0 };

const srsCard: SrsCardData = {
  id: "1",
  headword: "drizzle",
  ipa: "/ˈdrɪz.əl/",
  pos: "глагол",
  forms: ["drizzled", "drizzling"],
  meaning: "моросить; поливать тонкой струйкой",
  explanation: "to rain lightly, or to pour a thin stream over food",
  sentence: "She likes to {{gap}} olive oil over the salad.",
  collocations: ["drizzle with honey", "a light drizzle"],
  personalNote: "как дождик из масла",
  srs,
};

function card(id: string, word: string): Card {
  return {
    id, word,
    example: `An example sentence using ${word}.`,
    explanation: `A simple explanation of ${word}.`,
    translation: `перевод ${word}`,
    imageUrl: null, ipa: "/wɜːd/", pos: "noun", forms: [], collocations: [],
    sentence: `An example {{gap}} using it.`, personalNote: "", srs,
    easeFactor: 2.5, interval: 1, repetitions: 3, lapses: 0,
    dueAt: "2026-07-21T00:00:00Z", lastReviewedAt: null,
  };
}

const cards: Card[] = [card("a", "drizzle"), card("b", "serendipity"), card("c", "ephemeral")];

const profile: ProfileData = {
  learningLanguage: "en", translationLanguage: "ru", interfaceLanguage: "ru",
  dailyGoal: 20, todayCount: 12, streak: 7,
  activity: { "2026-07-20": 12, "2026-07-19": 25, "2026-07-18": 8, "2026-07-15": 30, "2026-07-10": 18 },
};

const params = new URLSearchParams(location.search);
localStorage.setItem("theme", params.get("theme") === "dark" ? "dark" : "light");
const view = params.get("view") ?? "srs";
const flipped = params.get("flipped") === "1";

function Demo() {
  let body: React.ReactNode;
  if (view === "library") body = <Library cards={cards} onCardUpdated={() => {}} onCardDeleted={() => {}} />;
  else if (view === "profile") body = <Profile profile={profile} onUpdate={() => {}} />;
  else body = (
    <div className="min-h-0 flex-1 pt-4">
      <SrsCard card={srsCard} learningLang="en-US" defaultFlipped={flipped} />
    </div>
  );
  return (
    <div className="mx-auto flex h-screen max-w-md flex-col px-4 pt-2">
      <TabBar tab={view === "library" ? "library" : view === "profile" ? "profile" : "review"} onChange={() => {}} />
      <main className="min-h-0 flex-1">{body}</main>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <PrefsProvider>
      <Demo />
    </PrefsProvider>
  </React.StrictMode>
);
