import { useState } from "react";
import type { Card, Grade } from "../lib/api";
import { api } from "../lib/api";
import { usePrefs } from "../lib/prefs";
import { toSrsCard } from "../lib/srsAdapter";
import { SrsCard } from "./srs/SrsCard";
import { RegenerateModal } from "./RegenerateModal";

// One-at-a-time SRS review. The top card is graded (Again/Hard/Good/Easy);
// grading advances to the next due card. Management actions (undo, delete,
// regenerate) sit in a compact row beneath the card.
export function ReviewDeck({
  cards,
  practice,
  learningLang,
  canUndo,
  onUndo,
  onStartPractice,
  onGraded,
  onNoteChange,
  onCardUpdated,
  onCardDeleted,
}: {
  cards: Card[];
  practice: boolean;
  learningLang: string;
  canUndo: boolean;
  onUndo: () => void;
  onStartPractice: () => void;
  onGraded: (card: Card, grade: Grade) => void;
  onNoteChange: (card: Card, note: string) => void;
  onCardUpdated: (card: Card) => void;
  onCardDeleted: (id: string) => void;
}) {
  const { t } = usePrefs();
  const [regenerating, setRegenerating] = useState(false);
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

  async function handleRegenerate(comment: string) {
    if (!top) return;
    setBusy(true);
    try {
      const { card } = await api.regenerateCard(top.id, comment);
      onCardUpdated(card);
    } catch (err) {
      console.error("Failed to regenerate card", err);
    } finally {
      setBusy(false);
      setRegenerating(false);
    }
  }

  const undoButton = canUndo && (
    <button
      type="button"
      onClick={onUndo}
      className="rounded-full bg-sky/40 px-4 py-2 text-sm font-medium text-ink shadow-soft dark:bg-sky/20"
    >
      ↩︎ {t("undo")}
    </button>
  );

  if (!top) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
        <p className="text-2xl">🎉</p>
        <p className="text-lg font-medium text-ink">{practice ? t("practiceEmpty") : t("emptyTitle")}</p>
        <p className="max-w-xs text-sm text-muted">{t("emptyHint")}</p>
        <div className="mt-2 flex items-center gap-3">
          {undoButton}
          <button
            type="button"
            onClick={onStartPractice}
            className="rounded-full bg-mint/50 px-5 py-2.5 text-sm font-medium text-ink shadow-soft dark:bg-mint/25"
          >
            📚 {t("studyMore")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-3">
      {practice && <p className="text-center text-xs text-muted">{t("practiceNote")}</p>}

      <div className="min-h-0 flex-1">
        <SrsCard
          key={top.id}
          card={toSrsCard(top)}
          learningLang={learningLang}
          onGrade={(grade) => onGraded(top, grade)}
          onNoteChange={(note) => onNoteChange(top, note)}
        />
      </div>

      <div className="flex items-center justify-center gap-2 pb-1">
        {undoButton}
        <button
          type="button"
          disabled={busy}
          onClick={handleDelete}
          className="rounded-full bg-blush/40 px-4 py-2 text-sm font-medium text-ink shadow-soft disabled:opacity-50 dark:bg-blush/20"
        >
          {t("delete")}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => setRegenerating(true)}
          className="rounded-full bg-butter/50 px-4 py-2 text-sm font-medium text-ink shadow-soft disabled:opacity-50 dark:bg-butter/20"
        >
          {t("regenerate")}
        </button>
      </div>

      {regenerating && (
        <RegenerateModal busy={busy} onCancel={() => setRegenerating(false)} onSubmit={handleRegenerate} />
      )}
    </div>
  );
}
