import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent, MouseEvent, PointerEvent, ReactNode } from "react";
import { usePrefs } from "../../lib/prefs";
import { speak } from "../../lib/speak";
import { haptic } from "../../lib/telegram";
import { GRADES, formatInterval, previewIntervals, schedule } from "../../lib/srs";
import type { Grade, SrsState } from "../../lib/srs";
import { splitCloze } from "../../lib/srsCard";
import type { SrsCard as SrsCardData } from "../../lib/srsCard";
import { deriveCloze } from "../../lib/srsAdapter";
import type { Card } from "../../lib/api";

// Solid grade fills from the ideal-flashcard spec (black text on top).
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

const parseList = (s: string) =>
  s
    .split(/[,·]/)
    .map((x) => x.trim())
    .filter(Boolean);

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

// Deliberate press-and-hold (500ms + haptic) so a stray tap while reading the
// card never triggers editing / the file picker. Returns handlers to spread on
// the target element.
function useLongPress(onTrigger: () => void) {
  const timer = useRef<number | null>(null);
  const clear = () => {
    if (timer.current !== null) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  };
  return {
    onPointerDown: (e: PointerEvent) => {
      e.stopPropagation();
      clear();
      timer.current = window.setTimeout(() => {
        timer.current = null;
        haptic("medium");
        onTrigger();
      }, 500);
    },
    onPointerUp: clear,
    onPointerLeave: clear,
    onPointerCancel: clear,
    onContextMenu: (e: MouseEvent) => e.preventDefault(),
  };
}

// A field that shows `children` normally and swaps to an input on long-press.
function EditableField({
  value,
  onSave,
  ariaLabel,
  multiline,
  inputClass,
  children,
}: {
  value: string;
  onSave: (v: string) => void;
  ariaLabel: string;
  multiline?: boolean;
  inputClass?: string;
  children: ReactNode;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const stop = (e: MouseEvent) => e.stopPropagation();
  const begin = () => {
    setDraft(value);
    setEditing(true);
  };
  const hold = useLongPress(begin);

  function commit() {
    setEditing(false);
    if (draft !== value) onSave(draft);
  }

  if (editing) {
    const cls = inputClass ?? "w-full rounded-lg border-2 border-black bg-white px-2 py-1 text-ink outline-none";
    return multiline ? (
      <textarea
        autoFocus
        rows={2}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onClick={stop}
        onKeyDown={(e) => e.stopPropagation()}
        onBlur={commit}
        className={`resize-none ${cls}`}
      />
    ) : (
      <input
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onClick={stop}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === "Enter") {
            e.preventDefault();
            commit();
          }
        }}
        onBlur={commit}
        className={cls}
      />
    );
  }

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={ariaLabel}
      {...hold}
      onClick={stop}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          e.stopPropagation();
          begin();
        }
      }}
      className="cursor-pointer select-none"
    >
      {children}
    </div>
  );
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
  onEdit,
  onUploadImage,
}: {
  card: SrsCardData;
  learningLang?: string;
  defaultFlipped?: boolean;
  onGrade?: (grade: Grade, next: SrsState) => void;
  onEdit?: (patch: Partial<Card>) => void;
  onUploadImage?: (file: File) => void;
}) {
  const { t } = usePrefs();
  const reduceMotion = usePrefersReducedMotion();
  const [flipped, setFlipped] = useState(defaultFlipped);
  const [hintStep, setHintStep] = useState(0); // 0 none -> 1 pos -> 2 first letters
  const fileRef = useRef<HTMLInputElement>(null);

  const cloze = splitCloze(card.sentence);
  const filled = cloze.before + card.headword + cloze.after;
  const intervals = previewIntervals(card.srs);
  const units = {
    lt10m: t("unitLt10m"),
    day: t("unitDay"),
    month: t("unitMonth"),
    year: t("unitYear"),
  };

  const toggleFlip = () => setFlipped((f) => !f);
  const stop = (e: MouseEvent) => e.stopPropagation();
  const imageHold = useLongPress(() => fileRef.current?.click());

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

  function grade(g: Grade, e: MouseEvent) {
    e.stopPropagation();
    onGrade?.(g, schedule(card.srs, g));
  }

  // Editing the filled sentence rewrites both the display text and the cloze.
  const saveSentence = (v: string) => onEdit?.({ example: v, sentence: deriveCloze(v, card.headword) });

  const sectionLabel = "text-xs font-semibold uppercase tracking-wide text-muted";
  const faceBase =
    "absolute inset-0 flex flex-col gap-5 overflow-y-auto rounded-[18px] border-2 border-black bg-surface p-6 [backface-visibility:hidden]";

  const gradeRow = () => (
    <div className="grid grid-cols-4 gap-2 pt-1">
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
  );

  const header = (label: string) => (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <span className={sectionLabel}>{label}</span>
        <FlipLink label={t("srsFlip")} onFlip={toggleFlip} />
      </div>
      <p className="flex items-center gap-1 text-[11px] text-muted">
        <span aria-hidden>✏️</span> {t("srsEditHint")}
      </p>
    </div>
  );

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={t("srsCardAria")}
      onClick={toggleFlip}
      onKeyDown={onCardKeyDown}
      className="mx-auto h-[560px] w-full max-w-sm cursor-pointer select-none outline-none [perspective:1200px]"
    >
      {/* Hidden picker shared by the image slot (front). */}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onClick={stop}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onUploadImage?.(f);
          e.currentTarget.value = "";
        }}
      />

      <div
        className="relative h-full w-full rounded-[18px] shadow-toon [transform-style:preserve-3d]"
        style={{
          transform: flipped ? "rotateY(180deg)" : "none",
          transition: reduceMotion ? "none" : "transform 0.5s",
        }}
      >
        {/* ---------- FRONT ---------- */}
        <div className={faceBase}>
          {header(t("srsFront"))}

          <EditableField
            value={filled}
            onSave={saveSentence}
            ariaLabel={t("srsFront")}
            multiline
            inputClass="w-full rounded-lg border-2 border-black bg-white p-2 font-serif text-xl text-ink outline-none"
          >
            <p className="font-serif text-2xl leading-relaxed text-ink">
              {cloze.before}
              <span className="mx-0.5 inline-flex min-w-[3.5rem] items-center justify-center rounded-md border-2 border-black bg-gap px-2 align-baseline text-ink">
                …
              </span>
              {cloze.after}
            </p>
          </EditableField>

          {/* Image: natural aspect, long-press to replace. */}
          <div className="flex justify-center py-1">
            {card.imageUrl ? (
              <div {...imageHold} onClick={stop} className="cursor-pointer">
                <img
                  src={card.imageUrl}
                  alt=""
                  className="mx-auto max-h-72 w-auto max-w-full rounded-2xl border-2 border-black object-contain"
                  onError={(e) => (e.currentTarget.style.display = "none")}
                />
              </div>
            ) : (
              <div
                role="button"
                tabIndex={0}
                {...imageHold}
                onClick={stop}
                className="flex h-32 w-full max-w-[240px] flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed border-black bg-white/60 px-3 text-center"
              >
                <span className="text-2xl" aria-hidden>
                  🖼️
                </span>
                <span className="text-xs text-muted">{t("srsAddImage")}</span>
              </div>
            )}
          </div>

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

          <div className="mt-auto flex flex-col gap-3">
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
              className="flex h-11 w-11 items-center justify-center self-start rounded-full border-2 border-black bg-white text-lg shadow-toon-sm"
            >
              🔊
            </button>
            {gradeRow()}
          </div>
        </div>

        {/* ---------- BACK ---------- */}
        <div className={`${faceBase} [transform:rotateY(180deg)] gap-4`}>
          {header(t("srsBack"))}

          <div className="flex flex-wrap items-center gap-3">
            <EditableField
              value={card.headword}
              onSave={(v) => onEdit?.({ word: v })}
              ariaLabel="headword"
              inputClass="w-full rounded-lg border-2 border-black bg-white px-2 py-1 font-serif text-2xl text-ink outline-none"
            >
              <h2 className="font-serif text-3xl leading-none text-ink">{card.headword}</h2>
            </EditableField>
            <EditableField value={card.ipa} onSave={(v) => onEdit?.({ ipa: v })} ariaLabel="IPA">
              {card.ipa ? (
                <span className="font-serif text-base italic text-muted">{card.ipa}</span>
              ) : (
                <span className="text-sm italic text-muted">＋ IPA</span>
              )}
            </EditableField>
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
            <EditableField value={card.meaning} onSave={(v) => onEdit?.({ translation: v })} ariaLabel="meaning">
              <p className="text-lg text-ink">{card.meaning}</p>
            </EditableField>
            <EditableField
              value={card.explanation ?? ""}
              onSave={(v) => onEdit?.({ explanation: v })}
              ariaLabel="explanation"
              multiline
            >
              <p className="mt-1 text-sm text-muted">{card.explanation || "＋ explanation"}</p>
            </EditableField>
          </div>

          <div className="flex flex-wrap gap-2 text-sm">
            <EditableField value={card.pos} onSave={(v) => onEdit?.({ pos: v })} ariaLabel="part of speech">
              <span className="rounded-full border border-black px-3 py-1 text-ink">{card.pos || "＋ pos"}</span>
            </EditableField>
            <EditableField
              value={card.forms.join(" · ")}
              onSave={(v) => onEdit?.({ forms: parseList(v) })}
              ariaLabel="forms"
            >
              <span className="rounded-full border border-black px-3 py-1 font-serif text-ink">
                {card.forms.length > 0 ? card.forms.join(" · ") : "＋ forms"}
              </span>
            </EditableField>
          </div>

          <EditableField
            value={filled}
            onSave={saveSentence}
            ariaLabel={t("srsBack")}
            multiline
            inputClass="w-full rounded-lg border-2 border-black bg-white p-2 font-serif text-base text-ink outline-none"
          >
            <p className="font-serif text-lg leading-relaxed text-ink">
              {cloze.before}
              <span className="rounded-md bg-gap px-1 font-semibold text-ink">{card.headword}</span>
              {cloze.after}
            </p>
          </EditableField>

          <EditableField
            value={card.collocations.join(", ")}
            onSave={(v) => onEdit?.({ collocations: parseList(v) })}
            ariaLabel="collocations"
            multiline
          >
            {card.collocations.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {card.collocations.map((c) => (
                  <span
                    key={c}
                    className="rounded-full border border-black bg-sky px-3 py-1.5 text-sm text-ink"
                  >
                    {c}
                  </span>
                ))}
              </div>
            ) : (
              <span className="text-sm italic text-muted">＋ collocations</span>
            )}
          </EditableField>

          <div className="border-l-[3px] border-black pl-3">
            <EditableField
              value={card.personalNote}
              onSave={(v) => onEdit?.({ personalNote: v })}
              ariaLabel={t("srsNotePlaceholder")}
              multiline
              inputClass="w-full rounded-lg border-2 border-black bg-white p-2 text-sm italic text-ink outline-none"
            >
              <p className={`text-sm italic ${card.personalNote ? "text-ink" : "text-muted"}`}>
                {card.personalNote || t("srsNotePlaceholder")}
              </p>
            </EditableField>
          </div>

          <div className="mt-auto">{gradeRow()}</div>
        </div>
      </div>
    </div>
  );
}
