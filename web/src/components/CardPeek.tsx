import type { Card } from "../lib/api";
import { usePrefs } from "../lib/prefs";
import { toSrsCard } from "../lib/srsAdapter";
import { SrsCard } from "./srs/SrsCard";

// A read-only look at a card, opened from a highlighted word inside an exercise.
// Deliberately NOT CardDetail: that one carries delete, regenerate and the grade
// buttons, and a stray tap mid-exercise would reschedule or destroy the card.
export function CardPeek({
  card,
  learningLang,
  onClose,
}: {
  card: Card;
  learningLang: string;
  onClose: () => void;
}) {
  const { t } = usePrefs();

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-page">
      <div className="flex items-center justify-between px-4 pt-[max(env(safe-area-inset-top),1rem)] text-oncanvas">
        <button type="button" onClick={onClose} className="rounded-full p-2 text-sm">
          ✕ {t("close")}
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4 pb-[max(env(safe-area-inset-bottom),1rem)]">
        <SrsCard card={toSrsCard(card)} learningLang={learningLang} readOnly />
      </div>
    </div>
  );
}
