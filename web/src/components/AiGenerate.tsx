import { useState } from "react";
import type { Card } from "../lib/api";
import { api } from "../lib/api";
import { usePrefs } from "../lib/prefs";

// AI tab: describe a set of cards in natural language and generate a themed
// batch of ideal flashcards in one go.
export function AiGenerate({ onCreated }: { onCreated: (cards: Card[]) => void }) {
  const { t } = usePrefs();
  const [request, setRequest] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<Card[] | null>(null);

  const examples = [t("aiExample1"), t("aiExample2"), t("aiExample3")];

  async function generate() {
    const text = request.trim();
    if (!text || busy) return;
    setBusy(true);
    setError(null);
    setCreated(null);
    try {
      const { cards } = await api.generateCardSet(text);
      setCreated(cards);
      onCreated(cards);
    } catch {
      setError(t("aiFailed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex h-full flex-col gap-3 overflow-y-auto pb-6 pt-1">
      <textarea
        value={request}
        onChange={(e) => setRequest(e.target.value)}
        rows={3}
        placeholder={t("aiPlaceholder")}
        className="resize-none rounded-2xl border-2 border-black bg-surface p-3 text-base text-ink shadow-toon outline-none placeholder:text-muted"
      />

      <div className="flex flex-wrap gap-2">
        {examples.map((ex) => (
          <button
            key={ex}
            type="button"
            onClick={() => setRequest(ex)}
            className="rounded-full border-2 border-dashed border-black px-3 py-1 text-xs font-semibold text-ink"
          >
            {ex}
          </button>
        ))}
      </div>

      <button
        type="button"
        disabled={!request.trim() || busy}
        onClick={generate}
        className="rounded-2xl border-2 border-black bg-mint px-4 py-3 text-sm font-semibold text-ink shadow-toon-sm disabled:opacity-50"
      >
        {busy ? t("aiGenerating") : `✨ ${t("aiGenerate")}`}
      </button>

      {error && <p className="text-center text-sm font-semibold text-red-500">{error}</p>}

      {created && (
        <div className="flex min-h-0 flex-1 flex-col gap-2">
          <p className="text-sm font-semibold text-oncanvas">
            ✓ {created.length} {t("aiCreated")}
          </p>
          <div className="flex flex-col gap-2">
            {created.map((c) => (
              <div
                key={c.id}
                className="rounded-2xl border-2 border-black bg-surface px-4 py-2 shadow-toon-sm"
              >
                <p className="text-base font-semibold text-ink">{c.word}</p>
                <p className="truncate text-sm text-muted">{c.translation}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
