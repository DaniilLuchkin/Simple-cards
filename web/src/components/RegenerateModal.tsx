import { useState } from "react";

export function RegenerateModal({
  busy,
  onSubmit,
  onCancel,
}: {
  busy: boolean;
  onSubmit: (comment: string) => void;
  onCancel: () => void;
}) {
  const [comment, setComment] = useState("");

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/20 backdrop-blur-sm sm:items-center">
      <div className="w-full max-w-sm rounded-t-card bg-white p-6 shadow-soft sm:rounded-card">
        <h3 className="mb-2 text-lg font-semibold text-ink">Перегенерировать карточку</h3>
        <p className="mb-4 text-sm text-muted">
          Опиши, что поправить — например «сделай пример проще» или «перевод неточный».
        </p>
        <textarea
          autoFocus
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={3}
          placeholder="Твой комментарий…"
          className="w-full rounded-2xl border border-sky/60 bg-sky/10 p-3 text-sm text-ink outline-none focus:border-sky"
        />
        <div className="mt-4 flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-2xl bg-gray-100 px-4 py-2.5 text-sm font-medium text-ink"
          >
            Отмена
          </button>
          <button
            type="button"
            disabled={busy || !comment.trim()}
            onClick={() => onSubmit(comment.trim())}
            className="flex-1 rounded-2xl bg-lilac/60 px-4 py-2.5 text-sm font-medium text-ink disabled:opacity-50"
          >
            {busy ? "Генерирую…" : "Готово"}
          </button>
        </div>
      </div>
    </div>
  );
}
