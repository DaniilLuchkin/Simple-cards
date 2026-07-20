import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent, MouseEvent } from "react";
import { usePrefs } from "../../lib/prefs";
import { speak } from "../../lib/speak";
import { GRADES, formatInterval, previewIntervals, schedule } from "../../lib/srs";
import type { Grade, SrsState } from "../../lib/srs";
import { splitCloze } from "../../lib/srsCard";
import type { SrsCard as SrsCardData } from "../../lib/srsCard";

// Solid grade fills from the ideal-flashcard spec (white text on top).
const GRADE_BG: Record<Grade, string> = {
  again: "bg-grade-again",
  hard: "bg-grade-hard",
  good: "bg-grade-good",
  easy: "bg-grade-easy",
};
const GRADE_LABEL: Record<Grade, "gradeAgain" | "gradeHard" | "gradeGood" | "gradeEasy"> = {
  again: "gradeAgain",
  hard: "gradeHard",
  good: "gradeGood",
  easy: "gradeEasy",
};

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(
    () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false
  );
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, []);
  return reduced;
}

// "ПЕРЕВЕРНУТЬ ⟳" control shared by both faces.
function FlipLink({ label, onFlip }: { label: string; onFlip: () => void }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onFlip();
      }}
      className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-accent"
    >
      {label} <span aria-hidden>⟳</span>
    </button>
  );
}

export function SrsCard({
  card,
  learningLang = "en-US",
  defaultFlipped = false,
  onGrade,
  onNoteChange,
}: {
  card: SrsCardData;
  learningLang?: string;
  defaultFlipped?: boolean;
  onGrade?: (grade: Grade, next: SrsState) => void;
  onNoteChange?: (note: string) => void;
}) {
  const { t } = usePrefs();
  const reduceMotion = usePrefersReducedMotion();
  const [flipped, setFlipped] = useState(defaultFlipped);
  const [hintStep, setHintStep] = useState(0); // 0 none -> 1 pos -> 2 first letters
  const [note, setNote] = useState(card.personalNote);
  const noteRef = useRef(card.personalNote);

  const cloze = splitCloze(card.sentence);
  const intervals = previewIntervals(card.srs);
  const units = {
    lt10m: t("unitLt10m"),
    day: t("unitDay"),
    month: t("unitMonth"),
    year: t("unitYear"),
  };

  const toggleFlip = () => setFlipped((f) => !f);
  const stop = (e: MouseEvent) => e.stopPropagation();

  function onCardKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.target !== e.currentTarget) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      toggleFlip();
    }
  }

  function cycleHint(e: MouseEvent) {
    e.stopPropagation();
    setHintStep((s) => (s + 1) % 3);
  }

  function saveNote() {
    if (noteRef.current === note) return;
    noteRef.current = note;
    onNoteChange?.(note);
  }

  function grade(g: Grade, e: MouseEvent) {
    e.stopPropagation();
    onGrade?.(g, schedule(card.srs, g));
  }

  const sectionLabel = "text-xs font-semibold uppercase tracking-wide text-muted";
  const faceBase =
    "absolute inset-0 flex flex-col gap-5 overflow-y-auto rounded-[18px] border-2 border-black bg-surface p-6 [backface-visibility:hidden]";

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={t("srsCardAria")}
      onClick={toggleFlip}
      onKeyDown={onCardKeyDown}
      className="mx-auto h-[560px] w-full max-w-sm cursor-pointer select-none outline-none [perspective:1200px]"
    >
      <div
        className="relative h-full w-full rounded-[18px] shadow-toon [transform-style:preserve-3d]"
        style={{
          transform: flipped ? "rotateY(180deg)" : "none",
          transition: reduceMotion ? "none" : "transform 0.5s",
        }}
      >
        {/* ---------- FRONT ---------- */}
        <div className={faceBase}>
          <div className="flex items-center justify-between">
            <span className={sectionLabel}>{t("srsFront")}</span>
            <FlipLink label={t("srsFlip")} onFlip={toggleFlip} />
          </div>

          <p className="font-serif text-2xl leading-relaxed text-ink">
            {cloze.before}
            <span className="mx-0.5 inline-flex min-w-[3.5rem] items-center justify-center rounded-md border-2 border-black bg-gap px-2 align-baseline text-ink">
              …
            </span>
            {cloze.after}
          </p>

          {card.imageUrl && (
            <div className="flex justify-center py-2">
              <img
                src={card.imageUrl}
                alt=""
                className="h-28 w-28 rounded-2xl border-2 border-black bg-white object-contain"
                onError={(e) => (e.currentTarget.style.display = "none")}
              />
            </div>
          )}

          <div className="flex flex-col items-start gap-3">
            <button
              type="button"
              onClick={cycleHint}
              className="rounded-full border-2 border-dashed border-black px-4 py-2 text-sm font-semibold text-ink"
            >
              {t("srsHint")}
            </button>
            {hintStep >= 1 && (
              <div className="flex flex-wrap gap-2 text-sm">
                {card.pos && (
                  <span className="rounded-full border border-black px-3 py-1 text-muted">{card.pos}</span>
                )}
                {/* Always reveal at least the first letter so the very first
                    tap gives a real hint (pos may be empty on legacy cards). */}
                <span className="rounded-full border border-black px-3 py-1 font-serif text-ink">
                  {card.headword.slice(0, hintStep >= 2 ? Math.min(3, card.headword.length) : 1)}…
                </span>
              </div>
            )}
          </div>

          <button
            type="button"
            aria-label={t("srsListen")}
            onClick={(e) => {
              stop(e);
              speak(cloze.before + card.headword + cloze.after, {
                audioUrl: card.audioUrl,
                lang: learningLang,
              });
            }}
            className="mt-auto flex h-11 w-11 items-center justify-center self-start rounded-full border-2 border-black bg-white text-lg shadow-toon-sm"
          >
            🔊
          </button>
        </div>

        {/* ---------- BACK ---------- */}
        <div className={`${faceBase} [transform:rotateY(180deg)] gap-4`}>
          <div className="flex items-center justify-between">
            <span className={sectionLabel}>{t("srsBack")}</span>
            <FlipLink label={t("srsFlip")} onFlip={toggleFlip} />
          </div>

          <div className="flex items-center gap-3">
            <h2 className="font-serif text-3xl leading-none text-ink">{card.headword}</h2>
            {card.ipa && <span className="font-serif text-base italic text-muted">{card.ipa}</span>}
            <button
              type="button"
              aria-label={t("srsListen")}
              onClick={(e) => {
                stop(e);
                speak(card.headword, { audioUrl: card.audioUrl, lang: learningLang });
              }}
              className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-black bg-white shadow-toon-sm"
            >
              🔊
            </button>
          </div>

          <div>
            <p className="text-lg text-ink">{card.meaning}</p>
            {card.explanation && <p className="mt-1 text-sm text-muted">{card.explanation}</p>}
          </div>

          {(card.pos || card.forms.length > 0) && (
            <div className="flex flex-wrap gap-2 text-sm">
              {card.pos && (
                <span className="rounded-full border border-black px-3 py-1 text-ink">{card.pos}</span>
              )}
              {card.forms.length > 0 && (
                <span className="rounded-full border border-black px-3 py-1 font-serif text-ink">
                  {card.forms.join(" · ")}
                </span>
              )}
            </div>
          )}

          <p className="font-serif text-lg leading-relaxed text-ink">
            {cloze.before}
            <span className="rounded-md bg-gap px-1 font-semibold text-ink">{card.headword}</span>
            {cloze.after}
          </p>

          {card.collocations.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {card.collocations.map((c) => (
                <span key={c} className="rounded-full border border-black bg-sky px-3 py-1.5 text-sm text-ink">
                  {c}
                </span>
              ))}
            </div>
          )}

          <div className="border-l-[3px] border-black pl-3">
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              onClick={stop}
              onKeyDown={(e) => e.stopPropagation()}
              onBlur={saveNote}
              rows={2}
              placeholder={t("srsNotePlaceholder")}
              className="w-full resize-none bg-transparent text-sm italic text-ink outline-none placeholder:not-italic placeholder:text-muted"
            />
          </div>

          <div className="mt-auto grid grid-cols-4 gap-2 pt-1">
            {GRADES.map((g) => (
              <button
                key={g}
                type="button"
                onClick={(e) => grade(g, e)}
                className={`flex min-h-[52px] flex-col items-center justify-center rounded-xl border-2 border-black px-1 text-ink shadow-toon-sm ${GRADE_BG[g]}`}
              >
                <span className="text-sm font-bold leading-tight">{t(GRADE_LABEL[g])}</span>
                <span className="text-[11px] opacity-80">{formatInterval(intervals[g], units)}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
