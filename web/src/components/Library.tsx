import { useState } from "react";
import type { Card } from "../lib/api";
import { api } from "../lib/api";
import { RegenerateModal } from "./RegenerateModal";

export function Library({
  cards,
  onCardUpdated,
  onCardDeleted,
}: {
  cards: Card[];
  onCardUpdated: (card: Card) => void;
  onCardDeleted: (cardId: string) => void;
}) {
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function handleDelete(id: string) {
    setBusyId(id);
    try {
      await api.deleteCard(id);
      onCardDeleted(id);
    } catch (err) {
      console.error("Failed to delete card", err);
    } finally {
      setBusyId(null);
    }
  }

  async function handleRegenerate(id: string, comment: string) {
    setBusyId(id);
    try {
      const { card } = await api.regenerateCard(id, comment);
      onCardUpdated(card);
    } catch (err) {
      console.error("Failed to regenerate card", err);
    } finally {
      setBusyId(null);
      setRegeneratingId(null);
    }
  }

  if (cards.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-center text-sm text-muted">
        Карточек пока нет. Пришли слово боту, чтобы создать первую.
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-3 overflow-y-auto pb-6">
      {cards.map((card) => (
        <div key={card.id} className="rounded-2xl bg-mint/30 p-4 shadow-soft">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-base font-semibold text-ink">{card.word}</p>
              <p className="truncate text-sm text-muted">{card.example}</p>
              <p className="mt-1 text-xs text-muted/70">
                Повторение: {new Date(card.dueAt).toLocaleDateString("ru-RU")}
              </p>
            </div>
            {card.imageUrl && (
              <img src={card.imageUrl} alt="" className="h-14 w-14 shrink-0 rounded-xl object-cover" />
            )}
          </div>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              disabled={busyId === card.id}
              onClick={() => handleDelete(card.id)}
              className="rounded-full bg-blush/40 px-4 py-1.5 text-xs font-medium text-ink disabled:opacity-50"
            >
              Удалить
            </button>
            <button
              type="button"
              disabled={busyId === card.id}
              onClick={() => setRegeneratingId(card.id)}
              className="rounded-full bg-butter/50 px-4 py-1.5 text-xs font-medium text-ink disabled:opacity-50"
            >
              Перегенерировать
            </button>
          </div>

          {regeneratingId === card.id && (
            <RegenerateModal
              busy={busyId === card.id}
              onCancel={() => setRegeneratingId(null)}
              onSubmit={(comment) => handleRegenerate(card.id, comment)}
            />
          )}
        </div>
      ))}
    </div>
  );
}
