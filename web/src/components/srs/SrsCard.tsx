import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent, MouseEvent } from "react";
import { usePrefs } from "../../lib/prefs";
import { speak } from "../../lib/speak";
import { GRADES, formatInterval, previewIntervals, schedule } from "../../lib/srs";
import type { Grade, SrsState } from "../../lib/srs";
import { splitCloze } from "../../lib/srsCard";
import type { SrsCard as SrsCardData } from "../../lib/srsCard";

// Grade -> Tailwind colour family. rose/amber/blue/emerald are full scales
// (the project only overrides `sky`), so their -500/-600 shades exist.
const GRADE_STYLES: Record<Grade, string> = {
  again: "border-rose-500/40 bg-rose-500/10 text-rose-600 dark:text-rose-400",
  hard: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400",
  good: "border-blue-500/40 bg-blue-500/10 text-blue-600 dark:text-blue-400",
  easy: "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
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
  // Hint ladder: 0 none -> 1 part of speech -> 2 first letters.
  const [hintStep, setHintStep] = useState(0);
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

  function toggleFlip() {
    setFlipped((f) => !f);
  }

  function onCardKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    // Only the card itself flips on Enter/Space; keystrokes inside the note or
    // on buttons must not.
    if (e.target !== e.currentTarget) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      toggleFlip();
    }
  }

  const stop = (e: MouseEvent) => e.stopPropagation();

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
        className="relative h-full w-full rounded-card shadow-soft [transform-style:preserve-3d]"
        style={{
          transform: flipped ? "rotateY(180deg)" : "none",
          transition: reduceMotion ? "none" : "transform 0.5s",
        }}
      >
        {/* ---------- FRONT ---------- */}
        <div
          className="absolute inset-0 flex flex-col gap-5 overflow-y-auto rounded-card bg-surface p-6 [backface-visibility:hidden]"
        >
          {(card.imageUrl || card.icon) && (
            <div className="flex justify-center">
              {card.imageUrl ? (
                <img
                  src={card.imageUrl}
                  alt=""
                  className="h-24 w-24 rounded-2xl object-cover"
                  onError={(e) => (e.currentTarget.style.display = "none")}
                />
              ) : (
                <span className="text-5xl">{card.icon}</span>
              )}
            </div>
          )}

          <div className="flex flex-1 flex-col justify-center">
            <p className="text-center font-serif text-2xl leading-relaxed text-ink">
              {cloze.before}
              <span
                aria-label="blank"
                className="mx-0.5 inline-block rounded-md bg-sky/60 px-1 align-baseline dark:bg-sky/30"
              >
                <span aria-hidden className="opacity-0">
                  {card.headword}
                </span>
              </span>
              {cloze.after}
            </p>

            {hintStep >= 1 && (
              <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-sm">
                <span className="rounded-full bg-lilac-fill px-3 py-1 text-muted">{card.pos}</span>
                {hintStep >= 2 && (
                  <span className="rounded-full bg-lilac-fill px-3 py-1 font-serif text-ink">
                    {card.headword.slice(0, Math.min(3, card.headword.length))}…
                  </span>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={cycleHint}
              className="flex min-h-[44px] items-center gap-1.5 rounded-full bg-sky/40 px-4 text-sm font-medium text-ink dark:bg-sky/20"
            >
              💡 {t("srsHint")}
            </button>
            <button
              type="button"
              aria-label={t("srsListen")}
              onClick={(e) => {
                stop(e);
                speak(card.sentence.replace("{{gap}}", card.headword), {
                  audioUrl: card.audioUrl,
                  lang: learningLang,
                });
              }}
              className="flex h-11 w-11 items-center justify-center rounded-full bg-sky/40 text-lg dark:bg-sky/20"
            >
              🔊
            </button>
          </div>

          <p className="text-center text-xs text-muted/70">{t("tapFlip")}</p>
        </div>

        {/* ---------- BACK ---------- */}
        <div
          className="absolute inset-0 flex flex-col gap-4 overflow-y-auto rounded-card bg-surface p-6 [backface-visibility:hidden] [transform:rotateY(180deg)]"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h2 className="font-serif text-3xl text-ink">{card.headword}</h2>
              <p className="text-sm text-muted">{card.ipa}</p>
            </div>
            <div className="flex shrink-0 gap-1.5">
              <button
                type="button"
                aria-label={`${t("srsListen")}: ${t("srsWord")}`}
                onClick={(e) => {
                  stop(e);
                  speak(card.headword, { audioUrl: card.audioUrl, lang: learningLang });
                }}
                className="flex h-11 w-11 items-center justify-center rounded-full bg-sky/40 dark:bg-sky/20"
              >
                🔊
              </button>
              <button
                type="button"
                aria-label={`${t("srsListen")}: ${t("srsPhrase")}`}
                onClick={(e) => {
                  stop(e);
                  speak(card.sentence.replace("{{gap}}", card.headword), { lang: learningLang });
                }}
                className="flex h-11 items-center justify-center rounded-full bg-sky/40 px-3 text-xs font-medium text-ink dark:bg-sky/20"
              >
                {t("srsPhrase")}
              </button>
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5 text-xs">
            <span className="rounded-full bg-lilac-fill px-2.5 py-1 text-muted">{card.pos}</span>
            {card.forms.map((form) => (
              <span key={form} className="rounded-full bg-lilac-fill px-2.5 py-1 font-serif text-ink">
                {form}
              </span>
            ))}
          </div>

          <div>
            <p className="text-base text-ink">{card.meaning}</p>
            {card.explanation && <p className="mt-1 text-sm text-muted">{card.explanation}</p>}
          </div>

          <p className="font-serif text-lg leading-relaxed text-ink">
            {cloze.before}
            <span className="rounded-md bg-sky/50 px-1 font-semibold dark:bg-sky/25">{card.headword}</span>
            {cloze.after}
          </p>

          <div>
            <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted">
              {t("srsCollocations")}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {card.collocations.map((c) => (
                <span key={c} className="rounded-full bg-mint-fill px-2.5 py-1 text-sm text-ink">
                  {c}
                </span>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted">
              {t("srsYourNote")}
            </p>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              onClick={stop}
              onKeyDown={(e) => e.stopPropagation()}
              onBlur={saveNote}
              rows={2}
              placeholder={t("srsNotePlaceholder")}
              className="w-full rounded-2xl border border-sky/60 bg-sky/10 p-2.5 text-sm text-ink outline-none focus:border-sky dark:border-sky/25"
            />
          </div>

          <div className="mt-auto grid grid-cols-4 gap-1.5 pt-1">
            {GRADES.map((g) => (
              <button
                key={g}
                type="button"
                onClick={(e) => grade(g, e)}
                className={`flex min-h-[44px] flex-col items-center justify-center rounded-2xl border ${GRADE_STYLES[g]}`}
              >
                <span className="text-sm font-semibold leading-tight">{t(GRADE_LABEL[g])}</span>
                <span className="text-[11px] opacity-80">{formatInterval(intervals[g], units)}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
