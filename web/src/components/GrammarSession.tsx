import { useRef, useState } from "react";
import type { Card, GrammarExercise } from "../lib/api";
import { usePrefs } from "../lib/prefs";
import { splitCloze } from "../lib/srsCard";
import { haptic } from "../lib/telegram";
import { useLongPress } from "../lib/useLongPress";
import { normalizeToken } from "../lib/wordIndex";

// Words the learner already has a card for are marked in exercise sentences and
// open that card. Purely lexical, so it never leaks a grammar answer.
const HIGHLIGHT =
  "rounded bg-sky px-0.5 underline decoration-black/40 decoration-dotted underline-offset-2";

function HighlightedText({
  text,
  index,
  onPick,
}: {
  text: string;
  index: Map<string, Card>;
  onPick: (card: Card) => void;
}) {
  // Split on whitespace but keep it, so the sentence spacing is preserved.
  return (
    <>
      {text.split(/(\s+)/).map((chunk, i) => {
        const card = /\s/.test(chunk) ? undefined : index.get(normalizeToken(chunk));
        if (!card) return <span key={i}>{chunk}</span>;
        return (
          <button
            key={i}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onPick(card);
            }}
            className={HIGHLIGHT}
          >
            {chunk}
          </button>
        );
      })}
    </>
  );
}

// A draggable-free word chip. Tap does the exercise's job (place / take back);
// press-and-hold opens the card, when the word is one of the learner's.
function WordChip({
  word,
  card,
  onTap,
  onPick,
  disabled,
  placed,
}: {
  word: string;
  card?: Card;
  onTap: () => void;
  onPick: (card: Card) => void;
  disabled: boolean;
  placed?: boolean;
}) {
  // A completed hold is followed by a click; swallow it so one gesture doesn't
  // both open the card and move the word.
  const suppressClick = useRef(false);
  const hold = useLongPress(() => {
    if (!card) return;
    suppressClick.current = true;
    onPick(card);
  });

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => {
        if (suppressClick.current) {
          suppressClick.current = false;
          return;
        }
        onTap();
      }}
      {...(card ? hold : {})}
      className={`rounded-lg border-2 border-black px-3 py-1.5 font-serif text-base text-ink shadow-toon-sm ${
        placed ? "bg-sky" : "bg-white"
      } ${card ? "underline decoration-black/40 decoration-dotted underline-offset-2" : ""}`}
    >
      {word}
    </button>
  );
}

/** Whitespace-normalised tokens, mirroring the server's sentenceTokens. */
function tokens(sentence: string): string[] {
  return sentence.trim().split(/\s+/).filter(Boolean);
}

// A round of grammar drills: one exercise at a time, answer, see why, next.
// Nothing here touches the SRS schedule - these are bonus practice.
export function GrammarSession({
  exercises,
  wordIndex,
  onPickWord,
  onRestart,
  onDone,
}: {
  exercises: GrammarExercise[];
  /** Every form of the learner's vocabulary -> its card. */
  wordIndex: Map<string, Card>;
  onPickWord: (card: Card) => void;
  onRestart: () => void;
  onDone: () => void;
}) {
  const { t } = usePrefs();
  const [index, setIndex] = useState(0);
  const [correct, setCorrect] = useState(0);
  // null while unanswered - the answer must not be revealed before then.
  const [result, setResult] = useState<boolean | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [placed, setPlaced] = useState<number[]>([]);

  const ex = exercises[index];
  const finished = index >= exercises.length;

  function answer(right: boolean) {
    setResult(right);
    setCorrect((c) => c + (right ? 1 : 0));
    haptic(right ? "light" : "medium");
  }

  function next() {
    setResult(null);
    setPicked(null);
    setPlaced([]);
    setIndex((i) => i + 1);
  }

  function restart() {
    setIndex(0);
    setCorrect(0);
    setResult(null);
    setPicked(null);
    setPlaced([]);
    onRestart(); // the caller fetches a fresh batch
  }

  if (finished) {
    const pct = exercises.length ? Math.round((correct / exercises.length) * 100) : 0;
    return (
      <div className="flex h-full flex-col gap-4 pt-1">
        <div className="rounded-2xl border-2 border-black bg-surface p-6 text-center shadow-toon">
          <p className="text-4xl">{pct >= 80 ? "🏆" : "✨"}</p>
          <p className="mt-2 text-xl font-bold text-ink">{t("grammarResult")}</p>
          <p className="mt-3 text-3xl font-bold text-ink">
            {correct}
            <span className="text-lg text-muted">/{exercises.length}</span>
          </p>
        </div>
        <div className="mt-auto flex flex-col gap-2">
          <button
            type="button"
            onClick={restart}
            className="rounded-2xl border-2 border-black bg-mint px-4 py-3.5 text-base font-bold text-ink shadow-toon"
          >
            ↻ {t("playAgain")}
          </button>
          <button
            type="button"
            onClick={onDone}
            className="rounded-2xl border-2 border-black bg-white px-4 py-2.5 text-sm font-semibold text-ink shadow-toon-sm"
          >
            {t("done")}
          </button>
        </div>
      </div>
    );
  }

  const placedWords = ex.type === "order" ? placed.map((i) => ex.words[i]) : [];
  const allPlaced = ex.type === "order" && placed.length === ex.words.length;

  return (
    <div className="flex h-full flex-col gap-3 pt-1">
      {/* Progress */}
      <div className="flex items-center gap-3 px-1">
        <div className="flex min-w-0 flex-1 items-center gap-1">
          {exercises.map((_, i) => (
            <span
              key={i}
              className={`h-2.5 min-w-0 flex-1 rounded-full border-2 border-black ${
                i < index ? "bg-mint" : "bg-white"
              }`}
            />
          ))}
        </div>
        <span className="shrink-0 text-xs font-semibold tabular-nums text-oncanvas opacity-70">
          {index + 1}/{exercises.length}
        </span>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto rounded-2xl border-2 border-black bg-surface p-5 shadow-toon">
        {ex.type === "gap" ? (
          <>
            <p className="font-serif text-xl leading-relaxed text-ink">
              <HighlightedText
                text={splitCloze(ex.sentence).before}
                index={wordIndex}
                onPick={onPickWord}
              />
              <span className="mx-0.5 inline-flex min-w-[4rem] items-center justify-center rounded-md border-2 border-black bg-gap px-2 align-baseline">
                {result === null ? "…" : ex.answer}
              </span>
              <HighlightedText
                text={splitCloze(ex.sentence).after}
                index={wordIndex}
                onPick={onPickWord}
              />
            </p>

            <div className="flex flex-col gap-2">
              {ex.options.map((opt) => {
                const isAnswer = opt === ex.answer;
                const isPicked = opt === picked;
                const tone =
                  result === null
                    ? "bg-white"
                    : isAnswer
                      ? "bg-grade-easy"
                      : isPicked
                        ? "bg-grade-again"
                        : "bg-white opacity-60";
                return (
                  <button
                    key={opt}
                    type="button"
                    disabled={result !== null}
                    onClick={() => {
                      setPicked(opt);
                      answer(isAnswer);
                    }}
                    className={`rounded-xl border-2 border-black px-4 py-2.5 text-base font-semibold text-ink shadow-toon-sm transition ${tone}`}
                  >
                    {opt}
                  </button>
                );
              })}
            </div>
          </>
        ) : (
          <>
            {/* The answer line being assembled */}
            <div className="flex min-h-[3.5rem] flex-wrap content-start gap-2 rounded-xl border-2 border-dashed border-black p-2">
              {placedWords.map((w, slot) => (
                <WordChip
                  key={`${w}-${slot}`}
                  word={w}
                  card={wordIndex.get(normalizeToken(w))}
                  placed
                  disabled={result !== null}
                  onTap={() => setPlaced((p) => p.filter((_, i) => i !== slot))}
                  onPick={onPickWord}
                />
              ))}
            </div>

            {/* The tray of remaining words */}
            <div className="flex flex-wrap gap-2">
              {ex.words.map((w, i) =>
                placed.includes(i) ? null : (
                  <WordChip
                    key={`${w}-${i}`}
                    word={w}
                    card={wordIndex.get(normalizeToken(w))}
                    disabled={result !== null}
                    onTap={() => setPlaced((p) => [...p, i])}
                    onPick={onPickWord}
                  />
                )
              )}
            </div>

            {result === null && (
              <button
                type="button"
                disabled={!allPlaced}
                onClick={() =>
                  answer(placedWords.join(" ") === tokens(ex.answer).join(" "))
                }
                className="mt-auto rounded-xl border-2 border-black bg-mint px-4 py-2.5 text-base font-bold text-ink shadow-toon-sm disabled:opacity-50"
              >
                {t("check")}
              </button>
            )}
          </>
        )}

        {result !== null && (
          <div className="mt-auto flex flex-col gap-2">
            <p
              className={`text-base font-bold ${result ? "text-emerald-600" : "text-red-500"}`}
            >
              {result ? `✅ ${t("answerRight")}` : `❌ ${t("answerWrong")}`}
            </p>
            {!result && ex.type === "order" && (
              <p className="font-serif text-base text-ink">
                <HighlightedText text={ex.answer} index={wordIndex} onPick={onPickWord} />
              </p>
            )}
            {ex.explanation && <p className="text-sm text-muted">{ex.explanation}</p>}
          </div>
        )}
      </div>

      {result !== null && (
        <button
          type="button"
          onClick={next}
          className="rounded-2xl border-2 border-black bg-mint px-4 py-3 text-base font-bold text-ink shadow-toon"
        >
          {t("next")} →
        </button>
      )}
    </div>
  );
}
