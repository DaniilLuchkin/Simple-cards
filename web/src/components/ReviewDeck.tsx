import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { Card, Grade } from "../lib/api";
import { api } from "../lib/api";
import { usePrefs } from "../lib/prefs";
import { toSrsCard } from "../lib/srsAdapter";
import { SrsCard } from "./srs/SrsCard";

// One-at-a-time SRS review. The top card is graded (Again/Hard/Good/Easy);
// grading advances to the next due card. Management actions (undo, delete,
// regenerate) sit in a compact row beneath the card.
export function ReviewDeck({
  cards,
  practice,
  learningLang,
  canUndo,
  combo,
  sessionDone,
  sessionSize,
  timed,
  secondsLeft,
  totalSeconds,
  onUndo,
  onStartPractice,
  onGraded,
  onEdit,
  onUploadImage,
  onGenerateImage,
  onCardUpdated,
  onCardDeleted,
}: {
  cards: Card[];
  practice: boolean;
  learningLang: string;
  canUndo: boolean;
  /** Current correct-answer streak within this round (0 = no combo). */
  combo: number;
  /** Cards graded so far in this round, and the round's length. */
  sessionDone: number;
  sessionSize: number;
  /** Timed round: a countdown replaces the pips (size is meaningless then). */
  timed: boolean;
  secondsLeft: number;
  totalSeconds: number;
  onUndo: () => void;
  onStartPractice: () => void;
  onGraded: (card: Card, grade: Grade) => void;
  onEdit: (card: Card, patch: Partial<Card>) => void;
  onUploadImage: (card: Card, file: File) => void;
  onGenerateImage: (card: Card) => Promise<void>;
  onCardUpdated: (card: Card) => void;
  onCardDeleted: (id: string) => void;
}) {
  const { t } = usePrefs();
  const [busy, setBusy] = useState(false);
  const top = cards[0];

  async function handleDelete() {
    if (!top || busy) return;
    setBusy(true);
    try {
      await api.deleteCard(top.id);
      onCardDeleted(top.id);
    } catch (err) {
      console.error("Failed to delete card", err);
    } finally {
      setBusy(false);
    }
  }

  async function handleRegenerate() {
    if (!top || busy) return;
    setBusy(true);
    try {
      const { card } = await api.regenerateCard(top.id);
      onCardUpdated(card);
    } catch (err) {
      console.error("Failed to regenerate card", err);
    } finally {
      setBusy(false);
    }
  }

  const undoButton = canUndo && (
    <button
      type="button"
      onClick={onUndo}
      className="rounded-full border-2 border-black bg-sky px-4 py-2 text-sm font-semibold text-ink shadow-toon-sm"
    >
      ↩︎ {t("undo")}
    </button>
  );

  if (!top) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-center text-oncanvas">
        <p className="text-2xl">🎉</p>
        <p className="text-lg font-semibold">{practice ? t("practiceEmpty") : t("emptyTitle")}</p>
        <p className="max-w-xs text-sm opacity-70">{t("emptyHint")}</p>
        <div className="mt-2 flex items-center gap-3">
          {undoButton}
          <button
            type="button"
            onClick={onStartPractice}
            className="rounded-full border-2 border-black bg-mint px-5 py-2.5 text-sm font-semibold text-ink shadow-toon-sm"
          >
            📚 {t("studyMore")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-3">
      {practice ? (
        <p className="text-center text-xs text-oncanvas opacity-70">{t("practiceNote")}</p>
      ) : (
        <SessionBar
          done={sessionDone}
          size={sessionSize}
          combo={combo}
          timed={timed}
          secondsLeft={secondsLeft}
          totalSeconds={totalSeconds}
        />
      )}

      <div className="min-h-0 flex-1">
        <SrsCard
          key={top.id}
          card={toSrsCard(top)}
          learningLang={learningLang}
          onGrade={(grade) => onGraded(top, grade)}
          onEdit={(patch) => onEdit(top, patch)}
          onUploadImage={(file) => onUploadImage(top, file)}
          onGenerateImage={() => onGenerateImage(top)}
        />
      </div>

      <div className="flex items-center justify-center gap-2 pb-1">
        {undoButton}
        <button
          type="button"
          disabled={busy}
          onClick={handleDelete}
          className="rounded-full border-2 border-black bg-blush px-4 py-2 text-sm font-semibold text-ink shadow-toon-sm disabled:opacity-50"
        >
          {t("delete")}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={handleRegenerate}
          className="rounded-full border-2 border-black bg-butter px-4 py-2 text-sm font-semibold text-ink shadow-toon-sm disabled:opacity-50"
        >
          {busy ? t("generating") : t("regenerate")}
        </button>
      </div>
    </div>
  );
}

// Round progress. Deliberately holds NOTHING that appears and disappears mid
// round: the combo badge used to live here and its mounting resized the
// flex-1 pips, so the whole bar jumped (and overflowed) on every combo.
function SessionBar({
  done,
  size,
  combo,
  timed,
  secondsLeft,
  totalSeconds,
}: {
  done: number;
  size: number;
  combo: number;
  timed: boolean;
  secondsLeft: number;
  totalSeconds: number;
}) {
  const { t } = usePrefs();

  if (timed) {
    const pct = totalSeconds > 0 ? Math.max(0, (secondsLeft / totalSeconds) * 100) : 0;
    const urgent = secondsLeft <= 10;
    return (
      <div className="flex items-center gap-3 px-1">
        <div className="h-2.5 min-w-0 flex-1 overflow-hidden rounded-full border-2 border-black bg-white">
          <div
            className={`h-full transition-[width] duration-200 ease-linear ${
              urgent ? "bg-grade-again" : "bg-mint"
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <span
          className={`shrink-0 text-xs font-semibold tabular-nums ${
            urgent ? "text-red-500" : "text-oncanvas opacity-70"
          }`}
        >
          {Math.ceil(secondsLeft)}
          {t("timedLeft")}
        </span>
        <span className="shrink-0 text-xs font-semibold tabular-nums text-oncanvas opacity-70">
          {done}
        </span>
        <ComboSlot combo={combo} />
      </div>
    );
  }

  const pct = size > 0 ? Math.min(100, Math.round((done / size) * 100)) : 0;
  return (
    <div className="flex items-center gap-3 px-1">
      {size <= 12 ? (
        <div className="flex min-w-0 flex-1 items-center gap-1">
          {Array.from({ length: size }, (_, i) => (
            <span
              key={i}
              className={`h-2.5 min-w-0 flex-1 rounded-full border-2 border-black transition-colors ${
                i < done ? "bg-mint" : "bg-white"
              }`}
            />
          ))}
        </div>
      ) : (
        <div className="h-2.5 min-w-0 flex-1 overflow-hidden rounded-full border-2 border-black bg-white">
          <div className="h-full bg-mint transition-all" style={{ width: `${pct}%` }} />
        </div>
      )}

      <span className="shrink-0 text-xs font-semibold tabular-nums text-oncanvas opacity-70">
        {done}/{size}
      </span>
      <ComboSlot combo={combo} />
    </div>
  );
}

// The combo lives in a fixed-width slot that is ALWAYS rendered, so the badge
// popping in and out can't resize the pips next to it. Floating it over the card
// was the other option, but there it covered the flip control.
function ComboSlot({ combo }: { combo: number }) {
  return (
    <span className="flex w-[52px] shrink-0 items-center justify-end">
      <AnimatePresence>
        {combo >= 2 && (
          <motion.span
            key={combo}
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.5, opacity: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 15 }}
            className="rounded-full border-2 border-black bg-butter px-1.5 py-0.5 text-xs font-bold leading-none text-ink shadow-toon-sm"
          >
            🔥{combo}
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  );
}
