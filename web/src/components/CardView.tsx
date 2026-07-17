import { motion } from "framer-motion";
import { useState } from "react";
import type { Card } from "../lib/api";
import { usePrefs } from "../lib/prefs";

/**
 * Two-sided card with a 3D flip. `flipped` is controlled by the parent
 * CardDetail (library preview) toggles it on click; the blurred-translation
 * reveal state lives here.
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
  const { t } = usePrefs();
  return (
    <div className="flex h-full w-full flex-col gap-5 rounded-card bg-sky-fill p-7">
      {card.imageUrl && (
        <img
          src={card.imageUrl}
          alt=""
          className="mx-auto max-h-[45%] max-w-full rounded-2xl object-contain shadow-soft"
          // If the file is gone (e.g. deploy without a persistent volume),
          // hide the slot instead of showing a broken-image icon.
          onError={(e) => (e.currentTarget.style.display = "none")}
        />
      )}
      <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
        <h2 className="text-3xl font-semibold text-ink">{card.word}</h2>
        <p className="text-base text-muted">{card.example}</p>
      </div>
      <p className="text-center text-xs text-muted/70">{t("tapFlip")}</p>
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
  const { t } = usePrefs();
  return (
    <div className="flex h-full w-full flex-col gap-5 rounded-card bg-lilac-fill p-7">
      <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
        <p className="text-lg leading-relaxed text-ink">{card.explanation}</p>
        <button
          type="button"
          // Tapping the translation must not flip the card. stopPropagation
          // handles CardDetail's React onClick; SwipeCard's framer-motion tap
          // listens on raw pointer events that fire before React's, so it
          // checks for this marker instead.
          data-no-flip
          onClick={(e) => {
            e.stopPropagation();
            onRevealTranslation();
          }}
          className="rounded-2xl bg-white/60 px-5 py-3 text-lg font-medium text-ink shadow-soft transition dark:bg-white/10"
        >
          <span className={translationRevealed ? "" : "blur-sm select-none"}>{card.translation}</span>
        </button>
      </div>
      <p className="text-center text-xs text-muted/70">{t("tapBack")}</p>
    </div>
  );
}
