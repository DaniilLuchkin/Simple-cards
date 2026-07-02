import { useState } from "react";
import type { Card } from "../lib/api";
import { usePrefs } from "../lib/prefs";
import { CardDetail } from "./CardDetail";

export function Library({
  cards,
  onCardUpdated,
  onCardDeleted,
}: {
  cards: Card[];
  onCardUpdated: (card: Card) => void;
  onCardDeleted: (cardId: string) => void;
}) {
  const { t, lang } = usePrefs();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedCard = cards.find((c) => c.id === selectedId) ?? null;

  if (cards.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-center text-sm text-muted">
        {t("libEmpty")}
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-3 overflow-y-auto pb-6">
      {cards.map((card) => (
        <button
          key={card.id}
          type="button"
          onClick={() => setSelectedId(card.id)}
          className="flex items-center gap-3 rounded-2xl bg-mint-fill p-4 text-left shadow-soft"
        >
          {card.imageUrl && (
            <img
              src={card.imageUrl}
              alt=""
              className="h-14 w-14 shrink-0 rounded-xl object-cover"
              onError={(e) => (e.currentTarget.style.display = "none")}
            />
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-semibold text-ink">{card.word}</p>
            <p className="truncate text-sm text-muted">{card.example}</p>
            <p className="mt-1 text-xs text-muted/70">
              {t("nextReview")}: {new Date(card.dueAt).toLocaleDateString(lang === "ru" ? "ru-RU" : "en-US")}
            </p>
          </div>
          <span className="shrink-0 text-muted/60">›</span>
        </button>
      ))}

      {selectedCard && (
        <CardDetail
          card={selectedCard}
          onClose={() => setSelectedId(null)}
          onUpdated={onCardUpdated}
          onDeleted={onCardDeleted}
        />
      )}
    </div>
  );
}
