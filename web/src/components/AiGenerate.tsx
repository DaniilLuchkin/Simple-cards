import { useState } from "react";
import type { Card, CardPreview } from "../lib/api";
import { api } from "../lib/api";
import { usePrefs } from "../lib/prefs";
import { deckArg } from "../lib/decks";

// Matches the server's generateSetSchema cap, so a long paste is bounded here
// instead of coming back as an opaque failure.
const MAX_REQUEST = 2000;

// AI tab: describe a set of cards in natural language, generate a themed batch
// of ideal flashcards (each with an illustration), then pick which to keep
// before adding them to the deck.
export function AiGenerate({
  onCreated,
  askDeck,
}: {
  onCreated: (cards: Card[]) => void;
  /** Which deck to save into; resolves to null if the user backs out. */
  askDeck: () => Promise<string | null>;
}) {
  const { t } = usePrefs();
  const [request, setRequest] = useState("");
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previews, setPreviews] = useState<CardPreview[] | null>(null);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [addedCount, setAddedCount] = useState<number | null>(null);

  const examples = [t("aiExample1"), t("aiExample2"), t("aiExample3")];

  async function generate() {
    const text = request.trim();
    if (!text || busy) return;
    setBusy(true);
    setError(null);
    setPreviews(null);
    setAddedCount(null);
    try {
      const { previews: p } = await api.generateCardSet(text);
      setPreviews(p);
      setChecked(new Set(p.map((c) => c.id))); // all selected by default
    } catch {
      setError(t("aiFailed"));
    } finally {
      setBusy(false);
    }
  }

  function toggle(id: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (!previews) return;
    setChecked((prev) => (prev.size === previews.length ? new Set() : new Set(previews.map((c) => c.id))));
  }

  async function addSelected() {
    if (!previews || saving) return;
    const chosen = previews.filter((c) => checked.has(c.id));
    if (!chosen.length) return;
    const deck = await askDeck();
    if (deck === null) return;
    setSaving(true);
    setError(null);
    try {
      const { cards } = await api.saveCardSet(
        chosen.map((c) => ({ fields: c.fields, imageUrl: c.imageUrl })),
        deckArg(deck)
      );
      onCreated(cards);
      setPreviews(null);
      setChecked(new Set());
      setAddedCount(cards.length);
    } catch {
      setError(t("aiSaveFailed"));
    } finally {
      setSaving(false);
    }
  }

  const allSelected = previews != null && checked.size === previews.length;

  return (
    <div className="flex h-full flex-col gap-3 pt-1">
      <textarea
        value={request}
        onChange={(e) => setRequest(e.target.value)}
        rows={3}
        maxLength={MAX_REQUEST}
        placeholder={t("aiPlaceholder")}
        className="resize-none rounded-2xl border-2 border-black bg-surface p-3 text-base text-ink shadow-toon outline-none placeholder:text-muted"
      />

      {/* Only once a long paste gets close to the cap, so it never fails
          opaquely on length. */}
      {request.length > MAX_REQUEST * 0.8 && (
        <p className="-mt-1 px-1 text-right text-[11px] text-muted">
          {request.length}/{MAX_REQUEST}
        </p>
      )}

      {!previews && (
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
      )}

      <button
        type="button"
        disabled={!request.trim() || busy}
        onClick={generate}
        className="rounded-2xl border-2 border-black bg-mint px-4 py-3 text-sm font-semibold text-ink shadow-toon-sm disabled:opacity-50"
      >
        {busy ? t("aiGenerating") : `✨ ${t("aiGenerate")}`}
      </button>

      {error && <p className="text-center text-sm font-semibold text-red-500">{error}</p>}

      {addedCount != null && (
        <p className="text-center text-sm font-semibold text-emerald-600">
          ✓ {addedCount} {t("aiCreated")}
        </p>
      )}

      {previews && (
        <>
          <div className="flex items-center justify-between px-1 text-oncanvas">
            <span className="text-xs opacity-70">{t("aiReview")}</span>
            <button
              type="button"
              onClick={toggleAll}
              className="rounded-full border-2 border-black bg-white px-3 py-1 text-xs font-semibold text-ink shadow-toon-sm"
            >
              {allSelected ? t("aiClearSel") : t("aiSelectAll")}
            </button>
          </div>

          <div className="-mx-2 flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-2 pb-2">
            {previews.map((c) => {
              const isChecked = checked.has(c.id);
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => toggle(c.id)}
                  aria-pressed={isChecked}
                  className={`flex w-full items-center gap-3 rounded-2xl border-2 border-black p-3 text-left shadow-toon-sm transition ${
                    isChecked ? "bg-surface" : "bg-surface/60 opacity-60"
                  }`}
                >
                  <span
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-black ${
                      isChecked ? "bg-emerald-400 text-ink" : "bg-white text-transparent"
                    }`}
                  >
                    ✓
                  </span>
                  {c.imageUrl && (
                    <img
                      src={c.imageUrl}
                      alt=""
                      className="h-14 w-14 shrink-0 rounded-xl border-2 border-black object-cover"
                      onError={(e) => (e.currentTarget.style.display = "none")}
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-base font-semibold text-ink">{c.word}</p>
                    <p className="truncate text-sm text-muted">{c.translation}</p>
                  </div>
                </button>
              );
            })}
          </div>

          <button
            type="button"
            disabled={saving || checked.size === 0}
            onClick={addSelected}
            className="rounded-2xl border-2 border-black bg-sky px-4 py-3 text-sm font-semibold text-ink shadow-toon-sm disabled:opacity-50"
          >
            {saving ? t("aiAdding") : `${t("aiAddSelected")} (${checked.size})`}
          </button>
        </>
      )}
    </div>
  );
}
