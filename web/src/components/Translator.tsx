import { useEffect, useRef, useState } from "react";
import type { Card } from "../lib/api";
import { api } from "../lib/api";
import { usePrefs } from "../lib/prefs";
import { languageName } from "../lib/i18n";
import { deckArg } from "../lib/decks";

// Google-Translate-style panel: one side is the language you're learning, the
// other your own language; a single button swaps them. After translating, one
// tap turns the learning-language term into a card.
export function Translator({
  learningLang,
  nativeLang,
  onCardCreated,
  askDeck,
}: {
  learningLang: string;
  nativeLang: string;
  onCardCreated: (card: Card) => void;
  /** Which deck to save into; resolves to null if the user backs out. */
  askDeck: () => Promise<string | null>;
}) {
  const { t } = usePrefs();
  // swapped=false: source = learning language, target = your language.
  const [swapped, setSwapped] = useState(false);
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [translating, setTranslating] = useState(false);
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reqId = useRef(0);

  const srcLang = swapped ? nativeLang : learningLang;
  const tgtLang = swapped ? learningLang : nativeLang;
  // The learning-language text (whichever side holds it) is what a card is made from.
  const learningText = (srcLang === learningLang ? input : output).trim();

  // Debounced auto-translate, like Google Translate.
  useEffect(() => {
    const text = input.trim();
    setCreated(false);
    if (!text) {
      setOutput("");
      setTranslating(false);
      return;
    }
    setTranslating(true);
    const id = ++reqId.current;
    const handle = setTimeout(async () => {
      try {
        const { translation } = await api.translate(text, srcLang, tgtLang);
        if (id === reqId.current) {
          setOutput(translation);
          setError(null);
        }
      } catch {
        if (id === reqId.current) setError(t("translateFailed"));
      } finally {
        if (id === reqId.current) setTranslating(false);
      }
    }, 700);
    return () => clearTimeout(handle);
  }, [input, srcLang, tgtLang, t]);

  function swap() {
    // Move the current translation into the input so it continues naturally.
    setInput(output);
    setOutput(input);
    setSwapped((s) => !s);
  }

  async function makeCard() {
    if (!learningText) return;
    const deck = await askDeck();
    if (deck === null) return;
    setCreating(true);
    setError(null);
    try {
      const { card } = await api.createCard(learningText, undefined, deckArg(deck));
      onCardCreated(card);
      setCreated(true);
    } catch {
      setError(t("captureFailed"));
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="flex h-full flex-col gap-3 overflow-y-auto pb-6 pt-1">
      {/* language bar with the swap button */}
      <div className="flex items-center gap-2 rounded-2xl border-2 border-black bg-surface px-3 py-2 shadow-toon">
        <span className="flex-1 truncate text-center text-sm font-semibold text-ink">{languageName(srcLang)}</span>
        <button
          type="button"
          onClick={swap}
          aria-label={t("swapLanguages")}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 border-black bg-sky text-lg text-ink shadow-toon-sm"
        >
          ⇄
        </button>
        <span className="flex-1 truncate text-center text-sm font-semibold text-ink">{languageName(tgtLang)}</span>
      </div>

      <textarea
        value={input}
        onChange={(e) => setInput(e.target.value)}
        rows={4}
        placeholder={t("translatePlaceholder")}
        className="resize-none rounded-2xl border-2 border-black bg-surface p-3 text-lg text-ink shadow-toon outline-none placeholder:text-muted"
      />

      <div className="min-h-[104px] rounded-2xl border-2 border-black bg-surface p-3 text-lg text-ink shadow-toon">
        {translating ? (
          <span className="text-muted">…</span>
        ) : output ? (
          output
        ) : (
          <span className="text-muted">{t("translationHere")}</span>
        )}
      </div>

      {error && <p className="text-center text-sm font-semibold text-red-500">{error}</p>}

      <button
        type="button"
        disabled={!learningText || translating || creating}
        onClick={makeCard}
        className="rounded-2xl border-2 border-black bg-mint px-4 py-3 text-sm font-semibold text-ink shadow-toon-sm disabled:opacity-50"
      >
        {creating ? t("captureGenerating") : created ? `✓ ${t("cardCreated")}` : `＋ ${t("makeCard")}`}
      </button>
    </div>
  );
}
