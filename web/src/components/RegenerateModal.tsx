import { useState } from "react";
import { usePrefs } from "../lib/prefs";

export function RegenerateModal({
  busy,
  onSubmit,
  onCancel,
}: {
  busy: boolean;
  onSubmit: (comment: string) => void;
  onCancel: () => void;
}) {
  const { t } = usePrefs();
  const [comment, setComment] = useState("");

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <div className="w-full max-w-sm rounded-[18px] border-2 border-black bg-surface p-6 shadow-toon-lg">
        <h3 className="mb-2 text-lg font-bold text-ink">{t("regenTitle")}</h3>
        <p className="mb-4 text-sm text-muted">{t("regenHint")}</p>
        <textarea
          autoFocus
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={3}
          placeholder={t("regenPlaceholder")}
          className="w-full rounded-2xl border-2 border-black bg-white p-3 text-sm text-ink outline-none"
        />
        <div className="mt-4 flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-2xl border-2 border-black bg-white px-4 py-2.5 text-sm font-semibold text-ink shadow-toon-sm"
          >
            {t("cancel")}
          </button>
          <button
            type="button"
            disabled={busy || !comment.trim()}
            onClick={() => onSubmit(comment.trim())}
            className="flex-1 rounded-2xl border-2 border-black bg-lilac px-4 py-2.5 text-sm font-semibold text-ink shadow-toon-sm disabled:opacity-50"
          >
            {busy ? t("generating") : t("done")}
          </button>
        </div>
      </div>
    </div>
  );
}
