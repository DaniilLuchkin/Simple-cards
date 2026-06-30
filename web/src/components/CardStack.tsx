import { useState } from "react";
import type { Card } from "../lib/api";
import { api } from "../lib/api";
import { SwipeCard } from "./SwipeCard";
import { RegenerateModal } from "./RegenerateModal";

const VISIBLE_STACK = 3;

export function CardStack({
  cards,
  onConsumed,
  onCardUpdated,
  onCardDeleted,
}: {
  cards: Card[];
  onConsumed: (card: Card) => void;
  onCardUpdated: (card: Card) => void;
  onCardDeleted: (cardId: string) => void;
}) {
  const [regenerating, setRegenerating] = useState(false);
  const [busy, setBusy] = useState(false);
  const top = cards[0];

  async function handleSwiped(card: Card, direction: "left" | "right") {
    onConsumed(card);
    try {
      await api.reviewCard(card.id, direction === "right" ? "remembered" : "forgot");
    } catch (err) {
      console.error("Failed to record review", err);
    }
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

  if (!top) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
        <p className="text-2xl">🎉</p>
        <p className="text-lg font-medium text-ink">Карточек на повторение пока нет</p>
        <p className="max-w-xs text-sm text-muted">
          Пришли боту новое слово, картинку или загляни позже — карточки появятся по расписанию.
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-4">
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
                  onSwiped={(dir) => handleSwiped(card, dir)}
                />
              </div>
            );
          })}
      </div>

      <div className="flex items-center justify-center gap-3 pb-2">
        <button
          type="button"
          disabled={busy}
          onClick={handleDelete}
          className="rounded-full bg-blush/40 px-5 py-2.5 text-sm font-medium text-ink shadow-soft disabled:opacity-50"
        >
          Удалить
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => setRegenerating(true)}
          className="rounded-full bg-butter/50 px-5 py-2.5 text-sm font-medium text-ink shadow-soft disabled:opacity-50"
        >
          Перегенерировать
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
