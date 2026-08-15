import { useEffect, useMemo, useState } from "react";
import { api } from "./lib/api";
import type {
  Card,
  Grade,
  GrammarExercise,
  Profile as ProfileData,
  ProfileUpdate,
  Sm2Snapshot,
} from "./lib/api";
import { usePrefs } from "./lib/prefs";
import { ReviewDeck } from "./components/ReviewDeck";
import { Library } from "./components/Library";
import { Profile } from "./components/Profile";
import { TabBar } from "./components/TabBar";
import type { Tab } from "./components/TabBar";
import { CameraButton } from "./components/CameraButton";
import { Translator } from "./components/Translator";
import { AiGenerate } from "./components/AiGenerate";
import { SessionStart } from "./components/SessionStart";
import { SessionSummary } from "./components/SessionSummary";
import { GrammarSession } from "./components/GrammarSession";
import { CardPeek } from "./components/CardPeek";
import { buildWordIndex } from "./lib/wordIndex";
import { isFasterThan } from "./lib/format";
import type { TimedBest } from "./lib/format";
import { haptic } from "./lib/telegram";

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
    lapses: card.lapses,
    dueAt: card.dueAt,
    lastReviewedAt: card.lastReviewedAt,
  };
}

type UndoInfo = { card: Card; snapshot: Sm2Snapshot; practice: boolean };

// Timed rounds: 60s by default, adjustable 30s..5min from the lobby.
const TIMED_DEFAULT_SECONDS = 60;
const TIMED_SECONDS_KEY = "timedSeconds";
const TIMED_BESTS_KEY = "timedBestRun";

function readTimedSeconds(): number {
  const raw = Number(localStorage.getItem(TIMED_SECONDS_KEY));
  return Number.isFinite(raw) && raw >= 30 && raw <= 300 ? raw : TIMED_DEFAULT_SECONDS;
}

// One record for all lengths: runs are compared by PACE (cards per minute), so
// a 5-minute run no longer automatically beats a 30-second one.
function readTimedBest(): TimedBest | null {
  try {
    const parsed = JSON.parse(localStorage.getItem(TIMED_BESTS_KEY) ?? "null");
    if (parsed && typeof parsed.count === "number" && typeof parsed.seconds === "number") {
      return parsed as TimedBest;
    }
  } catch {
    /* corrupt or legacy value - start fresh */
  }
  return null;
}

export type SessionMode = "normal" | "timed";

// A round in progress: how long it is and how it's going so far.
type SessionState = {
  mode: SessionMode;
  size: number;
  /** Wall-clock end for a timed round; null for a normal one. */
  endsAt: number | null;
  /** The chosen length of a timed round, so the countdown bar can scale. */
  totalSeconds: number;
  done: number;
  correct: number;
  combo: number;
  best: number;
};
type SessionResult = {
  reviewed: number;
  correct: number;
  bestCombo: number;
  timed: boolean;
  timedSeconds: number;
  record: boolean;
};

// A round runs until the daily goal is met; when it's already met (or the deck
// is short) fall back to a small fixed round so there's always something to play.
function plannedSessionSize(profile: ProfileData | null, due: number): number {
  const goal = profile?.dailyGoal ?? 10;
  const remaining = goal - (profile?.todayCount ?? 0);
  const target = remaining > 0 ? remaining : Math.min(10, goal);
  return Math.max(1, Math.min(target, due));
}

export function App() {
  const { t, uiLang, setUiLang } = usePrefs();
  const [tab, setTab] = useState<Tab>("review");
  const [dueCards, setDueCards] = useState<Card[] | null>(null);
  const [allCards, setAllCards] = useState<Card[] | null>(null);
  const [practiceCards, setPracticeCards] = useState<Card[] | null>(null);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [undoInfo, setUndoInfo] = useState<UndoInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Review is played in rounds: lobby -> playing -> summary.
  const [session, setSession] = useState<SessionState | null>(null);
  const [summary, setSummary] = useState<SessionResult | null>(null);
  // Grammar drills: "loading" while the batch is generated, then the exercises.
  const [grammar, setGrammar] = useState<GrammarExercise[] | "loading" | null>(null);
  const [grammarFailed, setGrammarFailed] = useState(false);
  // A word tapped inside an exercise, shown as a read-only card.
  const [peekCard, setPeekCard] = useState<Card | null>(null);
  const [timedSeconds, setTimedSeconds] = useState(readTimedSeconds);
  const [timedBest, setTimedBest] = useState<TimedBest | null>(readTimedBest);
  // Ticks only while a timed round is live, to drive the countdown.
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    api.getDueCards().then((res) => setDueCards(res.cards)).catch((err) => setError(String(err)));

    // The bot's /language command sets interfaceLanguage server-side - it's
    // the source of truth when present, overriding whatever this device
    // happened to have locally (e.g. first-ever open on a new device).
    api
      .getProfile()
      .then((res) => {
        setProfile(res.profile);
        if (res.profile.interfaceLanguage && res.profile.interfaceLanguage !== uiLang) {
          setUiLang(res.profile.interfaceLanguage);
        }
        // The day counter/streak roll over at this device's local midnight.
        // Persist the detected timezone so the server computes day boundaries
        // to match - only writing when it actually changed.
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
        if (tz && tz !== res.profile.timezone) {
          handleUpdateProfile({ timezone: tz });
        }
      })
      .catch((err) => setError(String(err)));
    // Intentionally run once on mount only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Timed round: tick the clock and end the round when it runs out. `session`
  // is read through a ref-free closure by re-running whenever it changes, and
  // the interval is torn down as soon as the round is over.
  useEffect(() => {
    if (!session?.endsAt) return;
    setNow(Date.now());
    const id = window.setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (t >= session.endsAt!) {
        window.clearInterval(id);
        finishSession(session);
      }
    }, 250);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  useEffect(() => {
    if (tab === "library" && allCards === null) {
      api.getAllCards().then((res) => setAllCards(res.cards)).catch((err) => setError(String(err)));
    }
    // Profile is refetched every time the tab opens so streak/today are fresh.
    if (tab === "profile") {
      api.getProfile().then((res) => setProfile(res.profile)).catch((err) => setError(String(err)));
    }
  }, [tab, allCards]);

  async function handleGraded(card: Card, grade: Grade) {
    if (practiceCards) {
      // Practice: advance without touching the schedule.
      setPracticeCards((prev) => prev?.filter((c) => c.id !== card.id) ?? prev);
      setUndoInfo({ card, snapshot: sm2Snapshot(card), practice: true });
      return;
    }

    const snapshot = sm2Snapshot(card);
    setDueCards((prev) => prev?.filter((c) => c.id !== card.id) ?? prev);

    // "Again" breaks the combo; anything else extends it.
    const correct = grade !== "again";
    const next = session
      ? {
          ...session,
          done: session.done + 1,
          correct: session.correct + (correct ? 1 : 0),
          combo: correct ? session.combo + 1 : 0,
          best: correct ? Math.max(session.best, session.combo + 1) : session.best,
        }
      : null;
    if (next) setSession(next);
    if (correct && (next?.combo ?? 0) >= 2) haptic("medium");

    try {
      await api.gradeCard(card.id, grade);
      setUndoInfo({ card, snapshot, practice: false });
    } catch (err) {
      console.error("Failed to record review", err);
    }

    if (!next) return;
    // A normal round ends at its card count; a timed one runs until the clock
    // stops, or early if the deck runs dry.
    const deckEmpty = (dueCards?.length ?? 0) <= 1;
    const over =
      next.mode === "timed" ? deckEmpty : next.done >= next.size || deckEmpty;
    if (over) await finishSession(next);
  }

  // Grammar is bonus practice: it deliberately records nothing server-side.
  async function startGrammar() {
    setGrammar("loading");
    setGrammarFailed(false);
    try {
      // The exercises highlight the learner's own words, so the deck has to be
      // loaded too - it otherwise only arrives when the Library tab opens.
      const [{ exercises }] = await Promise.all([
        api.getGrammarSet(),
        allCards === null
          ? api.getAllCards().then((res) => setAllCards(res.cards)).catch(() => {})
          : Promise.resolve(),
      ]);
      setGrammar(exercises);
    } catch (err) {
      console.error("Failed to load grammar exercises", err);
      setGrammar(null);
      setGrammarFailed(true);
    }
  }

  function startSession(mode: SessionMode = "normal", seconds = timedSeconds) {
    const size = plannedSessionSize(profile, dueCards?.length ?? 0);
    if (mode === "timed" && seconds !== timedSeconds) {
      setTimedSeconds(seconds);
      localStorage.setItem(TIMED_SECONDS_KEY, String(seconds));
    }
    setSummary(null);
    setSession({
      mode,
      size,
      endsAt: mode === "timed" ? Date.now() + seconds * 1000 : null,
      totalSeconds: seconds,
      done: 0,
      correct: 0,
      combo: 0,
      best: 0,
    });
  }

  // Ends the round: record it server-side (which settles quests and the streak)
  // and switch to the summary screen.
  async function finishSession(state: SessionState) {
    const timed = state.mode === "timed";
    const run: TimedBest = { count: state.done, seconds: state.totalSeconds };
    const record = timed && isFasterThan(run, timedBest);
    if (record) {
      setTimedBest(run);
      localStorage.setItem(TIMED_BESTS_KEY, JSON.stringify(run));
    }

    setSession(null);
    setSummary({
      reviewed: state.done,
      correct: state.correct,
      bestCombo: state.best,
      timed,
      timedSeconds: state.totalSeconds,
      record,
    });
    try {
      const { profile: updated } = await api.completeSession(state.best);
      setProfile(updated);
    } catch (err) {
      console.error("Failed to record session", err);
    }
  }

  function handleCardEdited(card: Card, patch: Partial<Card>) {
    handleCardUpdated({ ...card, ...patch });
    api.updateCard(card.id, patch).catch((err) => console.error("Failed to save edit", err));
  }

  async function handleUploadImage(card: Card, file: File) {
    try {
      const { card: updated } = await api.uploadCardImage(card.id, file);
      handleCardUpdated(updated);
    } catch (err) {
      console.error("Failed to upload image", err);
    }
  }

  async function handleGenerateImage(card: Card) {
    const { card: updated } = await api.generateCardImage(card.id);
    handleCardUpdated(updated);
  }

  function addNewCard(card: Card) {
    addCards([card]);
  }

  function addCards(cards: Card[]) {
    if (!cards.length) return;
    setDueCards((prev) => [...cards, ...(prev ?? [])]);
    setAllCards((prev) => (prev ? [...cards, ...prev] : prev));
  }

  // Capture a photo -> generate a new card -> put it at the front of the review
  // deck and switch to the Review tab so the user sees it right away.
  async function handleCaptureCard(file: File) {
    const { card } = await api.createCardFromImage(file);
    addNewCard(card);
    setTab("review");
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
  const wordIndex = useMemo(() => buildWordIndex(allCards ?? []), [allCards]);

  return (
    <div className="mx-auto flex h-[100dvh] max-w-md flex-col overflow-hidden px-4 pt-[max(env(safe-area-inset-top),0.5rem)]">
      <TabBar tab={tab} onChange={setTab} leading={<CameraButton onGenerate={handleCaptureCard} />} />

      <main className="min-h-0 flex-1 pb-[max(env(safe-area-inset-bottom),0.5rem)]">
        {error && <p className="p-4 text-center text-sm text-red-500">{error}</p>}

        {!error && tab === "ai" && <AiGenerate onCreated={addCards} />}

        {!error && tab === "translator" && (
          <Translator
            learningLang={profile?.learningLanguage ?? "en"}
            nativeLang={profile?.translationLanguage ?? "ru"}
            onCardCreated={addNewCard}
          />
        )}

        {!error && tab === "review" && (
          reviewCards === null ? (
            <p className="p-8 text-center text-sm text-oncanvas opacity-70">{t("loading")}</p>
          ) : grammar === "loading" ? (
            <p className="p-8 text-center text-sm text-oncanvas opacity-70">{t("grammarLoading")}</p>
          ) : grammar ? (
            <GrammarSession
              exercises={grammar}
              wordIndex={wordIndex}
              onPickWord={setPeekCard}
              onRestart={startGrammar}
              onDone={() => setGrammar(null)}
            />
          ) : summary ? (
            <SessionSummary
              reviewed={summary.reviewed}
              correct={summary.correct}
              bestCombo={summary.bestCombo}
              timed={summary.timed}
              timedSeconds={summary.timedSeconds}
              record={summary.record}
              profile={profile}
              canPlayAgain={(dueCards?.length ?? 0) > 0}
              onPlayAgain={() => startSession(summary.timed ? "timed" : "normal")}
              onDone={() => setSummary(null)}
            />
          ) : session || practice ? (
            <ReviewDeck
              cards={reviewCards}
              practice={practice}
              learningLang={profile?.learningLanguage ?? "en"}
              canUndo={undoInfo !== null}
              combo={session?.combo ?? 0}
              sessionDone={session?.done ?? 0}
              sessionSize={session?.size ?? 0}
              timed={session?.mode === "timed"}
              secondsLeft={session?.endsAt ? Math.max(0, (session.endsAt - now) / 1000) : 0}
              totalSeconds={session?.totalSeconds ?? TIMED_DEFAULT_SECONDS}
              onUndo={handleUndo}
              onStartPractice={startPractice}
              onGraded={handleGraded}
              onEdit={handleCardEdited}
              onUploadImage={handleUploadImage}
              onGenerateImage={handleGenerateImage}
              onCardUpdated={handleCardUpdated}
              onCardDeleted={handleCardDeleted}
            />
          ) : (
            <>
              {grammarFailed && (
                <p className="pb-2 text-center text-sm font-semibold text-red-500">
                  {t("grammarFailed")}
                </p>
              )}
            <SessionStart
              profile={profile}
              dueCount={dueCards?.length ?? 0}
              sessionSize={plannedSessionSize(profile, dueCards?.length ?? 0)}
              timedSeconds={timedSeconds}
              timedBest={timedBest}
              onPlay={() => startSession("normal")}
              onPlayTimed={(seconds) => startSession("timed", seconds)}
              onGrammar={startGrammar}
              onPractice={startPractice}
            />
            </>
          )
        )}

        {!error && tab === "library" && (
          allCards === null ? (
            <p className="p-8 text-center text-sm text-oncanvas opacity-70">{t("loading")}</p>
          ) : (
            <Library
              cards={allCards}
              learningLang={profile?.learningLanguage ?? "en"}
              onCardUpdated={handleCardUpdated}
              onCardDeleted={handleCardDeleted}
            />
          )
        )}

        {!error && tab === "profile" && (
          profile === null ? (
            <p className="p-8 text-center text-sm text-oncanvas opacity-70">{t("loading")}</p>
          ) : (
            <Profile profile={profile} onUpdate={handleUpdateProfile} />
          )
        )}
      </main>

      {peekCard && (
        <CardPeek
          card={peekCard}
          learningLang={profile?.learningLanguage ?? "en"}
          onClose={() => setPeekCard(null)}
        />
      )}
    </div>
  );
}
