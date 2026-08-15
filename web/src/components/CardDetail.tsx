import { useState } from "react";
import type { Card, Deck, Grade } from "../lib/api";
import { api } from "../lib/api";
import { usePrefs } from "../lib/prefs";
import { SrsCard } from "./srs/SrsCard";
import { toSrsCard } from "../lib/srsAdapter";
import { DeckChips } from "./DeckChips";

// Opening a card from "My cards" shows the same ideal flashcard as during
// review (flip, long-press edit, image upload/generate, grade buttons), plus
// delete/regenerate actions.
export function CardDetail({
  card,
  decks,
  learningLang,
  onClose,
  onUpdated,
  onDeleted,
}: {
  card: Card;
  decks: Deck[];
  learningLang: string;
  onClose: () => void;
  onUpdated: (card: Card) => void;
  onDeleted: (cardId: string) => void;
}) {
  const { t } = usePrefs();
  const [busy, setBusy] = useState(false);

  function handleEdit(patch: Partial<Card>) {
    onUpdated({ ...card, ...patch });
    api.updateCard(card.id, patch).catch((err) => console.error("Failed to save edit", err));
  }

  async function handleUploadImage(file: File) {
    try {
      const { card: updated } = await api.uploadCardImage(card.id, file);
      onUpdated(updated);
    } catch (err) {
      console.error("Failed to upload image", err);
    }
  }

  async function handleGenerateImage() {
    const { card: updated } = await api.generateCardImage(card.id);
    onUpdated(updated);
  }

  async function handleGrade(grade: Grade) {
    try {
      const { card: updated } = await api.gradeCard(card.id, grade);
      onUpdated(updated);
      onClose();
    } catch (err) {
      console.error("Failed to grade card", err);
    }
  }

  async function handleDelete() {
    setBusy(true);
    try {
      await api.deleteCard(card.id);
      onDeleted(card.id);
      onClose();
    } catch (err) {
      console.error("Failed to delete card", err);
      setBusy(false);
    }
  }

  async function handleRegenerate() {
    if (busy) return;
    setBusy(true);
    try {
      const { card: updated } = await api.regenerateCard(card.id);
      onUpdated(updated);
    } catch (err) {
      console.error("Failed to regenerate card", err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-page">
      <div className="flex items-center justify-between px-4 pt-[max(env(safe-area-inset-top),1rem)] text-oncanvas">
        <button type="button" onClick={onClose} className="rounded-full p-2 text-sm">
          ✕ {t("close")}
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <SrsCard
          key={card.id}
          card={toSrsCard(card)}
          learningLang={learningLang}
          onGrade={(grade) => handleGrade(grade)}
          onEdit={handleEdit}
          onUploadImage={handleUploadImage}
          onGenerateImage={handleGenerateImage}
        />

        {/* Move the card between decks; the general deck is "no deck". */}
        <div className="mt-4">
          <p className="px-1 pb-1 text-xs font-semibold text-oncanvas opacity-70">{t("deckManage")}</p>
          <DeckChips
            decks={decks}
            value={card.deckId ?? "none"}
            onChange={(value) => handleEdit({ deckId: value === "none" ? null : value ?? null })}
          />
        </div>
      </div>

      <div className="flex items-center justify-center gap-3 p-4 pb-[max(env(safe-area-inset-bottom),1rem)]">
        <button
          type="button"
          disabled={busy}
          onClick={handleDelete}
          className="rounded-full border-2 border-black bg-blush px-5 py-2.5 text-sm font-semibold text-ink shadow-toon-sm disabled:opacity-50"
        >
          {t("delete")}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={handleRegenerate}
          className="rounded-full border-2 border-black bg-butter px-5 py-2.5 text-sm font-semibold text-ink shadow-toon-sm disabled:opacity-50"
        >
          {busy ? t("generating") : t("regenerate")}
        </button>
      </div>
    </div>
  );
}
