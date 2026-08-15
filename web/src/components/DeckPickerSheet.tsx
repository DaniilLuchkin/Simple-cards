import { useState } from "react";
import type { Deck } from "../lib/api";
import { usePrefs } from "../lib/prefs";
import { DeckChips } from "./DeckChips";

/**
 * The save-time "which deck?" ask. Opens with the previously used deck already
 * selected, so the common case is a single tap on Save. A new deck can be
 * created without leaving the sheet.
 *
 * `value` follows the DeckChips convention: "none" = the general deck.
 */
export function DeckPickerSheet({
  decks,
  value,
  title,
  onCreate,
  onConfirm,
  onCancel,
}: {
  decks: Deck[];
  value: string;
  /** Defaults to the save-time wording; bulk moves pass their own. */
  title?: string;
  onCreate: (name: string) => Promise<Deck>;
  onConfirm: (value: string) => void;
  onCancel: () => void;
}) {
  const { t } = usePrefs();
  const [selected, setSelected] = useState(value);
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  async function create() {
    const trimmed = name.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    try {
      const deck = await onCreate(trimmed);
      setSelected(deck.id);
      setNaming(false);
      setName("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center">
      <div className="w-full max-w-sm rounded-[18px] border-2 border-black bg-surface p-5 shadow-toon-lg">
        <h3 className="mb-3 text-base font-bold text-ink">{title ?? t("deckSaveTo")}</h3>

        <DeckChips
          decks={decks}
          value={selected}
          onChange={(v) => setSelected(v ?? "none")}
          onAdd={naming ? undefined : () => setNaming(true)}
        />

        {naming && (
          <div className="mt-3 flex gap-2">
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && create()}
              placeholder={t("deckName")}
              maxLength={60}
              className="min-w-0 flex-1 rounded-2xl border-2 border-black bg-white px-3 py-2 text-sm text-ink outline-none placeholder:text-muted"
            />
            <button
              type="button"
              onClick={create}
              disabled={!name.trim() || busy}
              className="shrink-0 rounded-2xl border-2 border-black bg-mint px-3 py-2 text-sm font-semibold text-ink shadow-toon-sm disabled:opacity-50"
            >
              {t("deckCreate")}
            </button>
          </div>
        )}

        <button
          type="button"
          onClick={() => onConfirm(selected)}
          className="mt-4 w-full rounded-2xl border-2 border-black bg-mint px-4 py-2.5 text-sm font-semibold text-ink shadow-toon-sm"
        >
          {t("save")}
        </button>
        <button type="button" onClick={onCancel} className="mt-3 w-full text-center text-sm text-muted">
          {t("cancel")}
        </button>
      </div>
    </div>
  );
}
