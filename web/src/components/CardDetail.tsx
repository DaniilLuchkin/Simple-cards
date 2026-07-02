import { useState } from "react";
import type { Card } from "../lib/api";
import { api } from "../lib/api";
import { FlipCard } from "./CardView";
import { RegenerateModal } from "./RegenerateModal";

export function CardDetail({
  card,
  onClose,
  onUpdated,
  onDeleted,
}: {
  card: Card;
  onClose: () => void;
  onUpdated: (card: Card) => void;
  onDeleted: (cardId: string) => void;
}) {
  const [flipped, setFlipped] = useState(false);
  const [editing, setEditing] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    word: card.word,
    example: card.example,
    explanation: card.explanation,
    translation: card.translation,
  });

  async function handleSave() {
    setBusy(true);
    try {
      const { card: updated } = await api.updateCard(card.id, form);
      onUpdated(updated);
      setEditing(false);
    } catch (err) {
      console.error("Failed to update card", err);
    } finally {
      setBusy(false);
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

  async function handleRegenerate(comment: string) {
    setBusy(true);
    try {
      const { card: updated } = await api.regenerateCard(card.id, comment);
      onUpdated(updated);
      setForm({
        word: updated.word,
        example: updated.example,
        explanation: updated.explanation,
        translation: updated.translation,
      });
    } catch (err) {
      console.error("Failed to regenerate card", err);
    } finally {
      setBusy(false);
      setRegenerating(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white">
      <div className="flex items-center justify-between px-4 pt-[max(env(safe-area-inset-top),1rem)]">
        <button type="button" onClick={onClose} className="rounded-full p-2 text-sm text-muted">
          ✕ Закрыть
        </button>
        <button
          type="button"
          onClick={() => setEditing((e) => !e)}
          className="rounded-full bg-sky/40 px-4 py-1.5 text-sm font-medium text-ink"
        >
          {editing ? "Отмена" : "Редактировать"}
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {editing ? (
          <div className="mx-auto flex max-w-sm flex-col gap-4">
            <Field label="Слово" value={form.word} onChange={(v) => setForm((f) => ({ ...f, word: v }))} />
            <Field
              label="Пример"
              value={form.example}
              onChange={(v) => setForm((f) => ({ ...f, example: v }))}
              multiline
            />
            <Field
              label="Объяснение (простой English)"
              value={form.explanation}
              onChange={(v) => setForm((f) => ({ ...f, explanation: v }))}
              multiline
            />
            <Field
              label="Перевод"
              value={form.translation}
              onChange={(v) => setForm((f) => ({ ...f, translation: v }))}
            />
            <button
              type="button"
              disabled={busy}
              onClick={handleSave}
              className="rounded-2xl bg-mint/50 px-4 py-2.5 text-sm font-medium text-ink shadow-soft disabled:opacity-50"
            >
              {busy ? "Сохраняю…" : "Сохранить"}
            </button>
          </div>
        ) : (
          <div
            className="relative mx-auto aspect-[3/4] max-w-sm cursor-pointer"
            onClick={() => setFlipped((f) => !f)}
          >
            <FlipCard card={card} flipped={flipped} />
          </div>
        )}
      </div>

      <div className="flex items-center justify-center gap-3 p-4 pb-[max(env(safe-area-inset-bottom),1rem)]">
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

function Field({
  label,
  value,
  onChange,
  multiline,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  multiline?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1.5 text-left">
      <span className="text-xs font-medium text-muted">{label}</span>
      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
          className="rounded-2xl border border-sky/60 bg-sky/10 p-3 text-sm text-ink outline-none focus:border-sky"
        />
      ) : (
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="rounded-2xl border border-sky/60 bg-sky/10 p-3 text-sm text-ink outline-none focus:border-sky"
        />
      )}
    </label>
  );
}
