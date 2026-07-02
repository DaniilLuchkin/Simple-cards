import { motion, useMotionValue, useTransform } from "framer-motion";
import { useState } from "react";
import type { Card } from "../lib/api";
import { api } from "../lib/api";
import { usePrefs } from "../lib/prefs";
import { SwipeCard } from "./SwipeCard";
import { RegenerateModal } from "./RegenerateModal";

const VISIBLE_STACK = 3;

export function CardStack({
  cards,
  practice,
  canUndo,
  onUndo,
  onStartPractice,
  onSwiped,
  onCardUpdated,
  onCardDeleted,
}: {
  cards: Card[];
  practice: boolean;
  canUndo: boolean;
  onUndo: () => void;
  onStartPractice: () => void;
  onSwiped: (card: Card, direction: "left" | "right") => void;
  onCardUpdated: (card: Card) => void;
  onCardDeleted: (cardId: string) => void;
}) {
  const { t } = usePrefs();
  const [regenerating, setRegenerating] = useState(false);
  const [busy, setBusy] = useState(false);
  const top = cards[0];

  // Shared with the active card so the feedback overlays below can react to
  // the drag in real time.
  const dragX = useMotionValue(0);
  const rememberOpacity = useTransform(dragX, [15, 70], [0, 1]);
  const forgotOpacity = useTransform(dragX, [-70, -15], [1, 0]);

  function handleSwiped(card: Card, direction: "left" | "right") {
    dragX.set(0);
    onSwiped(card, direction);
  }

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
      className="rounded-full bg-sky/40 px-5 py-2.5 text-sm font-medium text-ink shadow-soft dark:bg-sky/20"
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
    <div className="flex h-full flex-col gap-4">
      {practice && (
        <p className="text-center text-xs text-muted">{t("practiceNote")}</p>
      )}

      <div className="relative flex-1">
        {cards
          .slice(0, VISIBLE_STACK)
          .reverse()
          .map((card, i, arr) => {
            const isTop = i === arr.length - 1;
            const depth = arr.length - 1 - i;
            return (
              <div
                key={card.id}
                className="absolute inset-0"
                style={{
                  transform: `translateY(${depth * 10}px) scale(${1 - depth * 0.04})`,
                  zIndex: i,
                }}
              >
                <SwipeCard
                  card={card}
                  active={isTop}
                  reportDragX={isTop ? dragX : undefined}
                  onSwiped={(dir) => handleSwiped(card, dir)}
                />
              </div>
            );
          })}
      </div>

      {/* Drag feedback: the whole viewport tints green (right = "got it") or
          red (left = "forgot") while the card is pulled. */}
      <motion.div
        style={{ opacity: rememberOpacity }}
        className="pointer-events-none fixed inset-0 z-40 bg-gradient-to-l from-emerald-400/50 via-emerald-400/15 to-transparent"
      />
      <motion.div
        style={{ opacity: rememberOpacity }}
        className="pointer-events-none fixed inset-y-0 right-3 z-40 flex items-center"
      >
        <span className="rounded-2xl bg-emerald-500/90 px-4 py-2 text-lg font-bold text-white shadow-soft">
          ✓ {t("remember")}
        </span>
      </motion.div>

      <motion.div
        style={{ opacity: forgotOpacity }}
        className="pointer-events-none fixed inset-0 z-40 bg-gradient-to-r from-rose-400/50 via-rose-400/15 to-transparent"
      />
      <motion.div
        style={{ opacity: forgotOpacity }}
        className="pointer-events-none fixed inset-y-0 left-3 z-40 flex items-center"
      >
        <span className="rounded-2xl bg-rose-500/90 px-4 py-2 text-lg font-bold text-white shadow-soft">
          ✕ {t("forgot")}
        </span>
      </motion.div>

      <div className="flex items-center justify-center gap-3 pb-2">
        {undoButton}
        <button
          type="button"
          disabled={busy}
          onClick={handleDelete}
          className="rounded-full bg-blush/40 px-5 py-2.5 text-sm font-medium text-ink shadow-soft disabled:opacity-50 dark:bg-blush/20"
        >
          {t("delete")}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => setRegenerating(true)}
          className="rounded-full bg-butter/50 px-5 py-2.5 text-sm font-medium text-ink shadow-soft disabled:opacity-50 dark:bg-butter/20"
        >
          {t("regenerate")}
        </button>
      </div>

      {regenerating && (
        <RegenerateModal
          busy={busy}
          onCancel={() => setRegenerating(false)}
          onSubmit={handleRegenerate}
        />
      )}
    </div>
  );
}
