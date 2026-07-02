import { motion } from "framer-motion";
import { useState } from "react";
import type { Card } from "../lib/api";

/**
 * Two-sided card with a 3D flip. `flipped` is controlled by the parent
 * (SwipeCard toggles it on tap, CardDetail on click); the blurred-translation
 * reveal state lives here since both usages behave identically.
 */
export function FlipCard({ card, flipped }: { card: Card; flipped: boolean }) {
  const [translationRevealed, setTranslationRevealed] = useState(false);

  return (
    <motion.div
      className="relative h-full w-full rounded-card shadow-soft"
      style={{ transformStyle: "preserve-3d" }}
      animate={{ rotateY: flipped ? 180 : 0 }}
      transition={{ duration: 0.45 }}
    >
      <div className="absolute inset-0" style={{ backfaceVisibility: "hidden" }}>
        <CardFront card={card} />
      </div>
      <div
        className="absolute inset-0"
        style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
      >
        <CardBack
          card={card}
          translationRevealed={translationRevealed}
          onRevealTranslation={() => setTranslationRevealed((r) => !r)}
        />
      </div>
    </motion.div>
  );
}

function CardFront({ card }: { card: Card }) {
  return (
    <div className="flex h-full w-full flex-col gap-5 rounded-card bg-sky/40 p-7">
      {card.imageUrl && (
        <img
          src={card.imageUrl}
          alt=""
          className="h-40 w-full rounded-2xl object-cover shadow-soft"
          // If the file is gone (e.g. deploy without a persistent volume),
          // hide the slot instead of showing a broken-image icon.
          onError={(e) => (e.currentTarget.style.display = "none")}
        />
      )}
      <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
        <h2 className="text-3xl font-semibold text-ink">{card.word}</h2>
        <p className="text-base text-muted">{card.example}</p>
      </div>
      <p className="text-center text-xs text-muted/70">Нажми, чтобы перевернуть</p>
    </div>
  );
}

function CardBack({
  card,
  translationRevealed,
  onRevealTranslation,
}: {
  card: Card;
  translationRevealed: boolean;
  onRevealTranslation: () => void;
}) {
  return (
    <div className="flex h-full w-full flex-col gap-5 rounded-card bg-lilac/40 p-7">
      <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
        <p className="text-lg leading-relaxed text-ink">{card.explanation}</p>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRevealTranslation();
          }}
          // Keep the press from reaching the swipe gesture handlers - tapping
          // the translation should never flip or drag the card.
          onPointerDown={(e) => e.stopPropagation()}
          className="rounded-2xl bg-white/60 px-5 py-3 text-lg font-medium text-ink shadow-soft transition"
        >
          <span className={translationRevealed ? "" : "blur-sm select-none"}>{card.translation}</span>
        </button>
      </div>
      <p className="text-center text-xs text-muted/70">Нажми ещё раз, чтобы вернуться</p>
    </div>
  );
}
