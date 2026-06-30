import type { Card } from "../lib/api";

export function CardFront({ card }: { card: Card }) {
  return (
    <div className="flex h-full w-full flex-col gap-5 rounded-card bg-sky/40 p-7">
      {card.imageUrl && (
        <img
          src={card.imageUrl}
          alt=""
          className="h-40 w-full rounded-2xl object-cover shadow-soft"
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

export function CardBack({
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
          className="rounded-2xl bg-white/60 px-5 py-3 text-lg font-medium text-ink shadow-soft transition"
        >
          <span className={translationRevealed ? "" : "blur-sm select-none"}>{card.translation}</span>
        </button>
      </div>
      <p className="text-center text-xs text-muted/70">Нажми ещё раз, чтобы вернуться</p>
    </div>
  );
}
