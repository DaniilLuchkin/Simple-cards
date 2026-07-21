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
import { localizePos } from "../../lib/pos";
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

// Deliberate press-and-hold (500ms + haptic). Returns handlers to spread on the
// target so a stray tap never triggers it.
function useLongPress(onTrigger: () => void) {
  const timer = useRef<number | null>(null);
  const clear = () => {
    if (timer.current !== null) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  };
  return {
    onPointerDown: () => {
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
  onGenerateImage,
}: {
  card: SrsCardData;
  learningLang?: string;
  defaultFlipped?: boolean;
  onGrade?: (grade: Grade, next: SrsState) => void;
  onEdit?: (patch: Partial<Card>) => void;
  onUploadImage?: (file: File) => void;
  onGenerateImage?: () => Promise<void> | void;
}) {
  const { t, uiLang } = usePrefs();
  const reduceMotion = usePrefersReducedMotion();
  const [flipped, setFlipped] = useState(defaultFlipped);
  const [hintStep, setHintStep] = useState(0); // 0 none -> 1 pos -> 2 first letters
  const [editing, setEditing] = useState(false);
  const suppressClick = useRef(false);

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
  const editHold = useLongPress(() => {
    suppressClick.current = true;
    setEditing(true);
  });

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

  if (editing) {
    return (
      <EditForm
        card={card}
        onDone={(patch) => {
          onEdit?.(patch);
          setEditing(false);
        }}
        onCancel={() => setEditing(false)}
        onUploadImage={onUploadImage}
        onGenerateImage={onGenerateImage}
      />
    );
  }

  const sectionLabel = "text-xs font-semibold uppercase tracking-wide text-muted";
  const faceBase =
    "absolute inset-0 flex flex-col gap-4 overflow-y-auto rounded-[18px] border-2 border-black bg-surface p-6 [backface-visibility:hidden]";

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
      onClick={() => {
        if (suppressClick.current) {
          suppressClick.current = false;
          return;
        }
        toggleFlip();
      }}
      onPointerDown={editHold.onPointerDown}
      onPointerUp={editHold.onPointerUp}
      onPointerLeave={editHold.onPointerLeave}
      onPointerCancel={editHold.onPointerCancel}
      onContextMenu={editHold.onContextMenu}
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
          {header(t("srsFront"))}

          <p className="font-serif text-2xl leading-relaxed text-ink">
            {cloze.before}
            <span className="mx-0.5 inline-flex min-w-[3.5rem] items-center justify-center rounded-md border-2 border-black bg-gap px-2 align-baseline text-ink">
              …
            </span>
            {cloze.after}
          </p>

          {/* Image takes only the leftover space so audio + grades stay visible. */}
          {card.imageUrl && (
            <div className="flex min-h-0 flex-1 items-center justify-center">
              <img
                src={card.imageUrl}
                alt=""
                className="max-h-full w-auto max-w-full rounded-2xl border-2 border-black object-contain"
                onError={(e) => (e.currentTarget.style.display = "none")}
              />
            </div>
          )}

          <div className={`flex flex-col gap-3 ${card.imageUrl ? "" : "mt-auto"}`}>
            {/* Hint on the left (the hint itself replaces the button in place, so
                the row keeps its height and never resizes the image); audio
                pinned to the right. */}
            <div className="flex items-center justify-between gap-3">
              {hintStep === 0 ? (
                <button
                  type="button"
                  onClick={cycleHint}
                  className="rounded-full border-2 border-dashed border-black px-4 py-2 text-sm font-semibold text-ink"
                >
                  {t("srsHint")}
                </button>
              ) : (
                <div
                  role="button"
                  onClick={cycleHint}
                  className="flex cursor-pointer select-none flex-wrap items-center gap-2 text-sm"
                >
                  {card.pos && (
                    <span className="rounded-full border border-black px-3 py-1 text-muted">
                      {localizePos(card.pos, uiLang)}
                    </span>
                  )}
                  <span className="rounded-full border border-black px-3 py-1 font-serif text-ink">
                    {card.headword.slice(0, hintStep >= 2 ? Math.min(3, card.headword.length) : 1)}…
                  </span>
                </div>
              )}
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
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 border-black bg-white text-lg shadow-toon-sm"
              >
                🔊
              </button>
            </div>
            {gradeRow()}
          </div>
        </div>

        {/* ---------- BACK ---------- */}
        <div className={`${faceBase} [transform:rotateY(180deg)]`}>
          {header(t("srsBack"))}

          <div className="flex flex-wrap items-center gap-3">
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

          {card.personalNote && (
            <div className="border-l-[3px] border-black pl-3">
              <p className="text-sm italic text-ink">{card.personalNote}</p>
            </div>
          )}

          <div className="mt-auto">{gradeRow()}</div>
        </div>
      </div>
    </div>
  );
}

// ---------- Edit mode: the whole card becomes a form ----------

function Field({
  label,
  value,
  onChange,
  multiline,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  multiline?: boolean;
}) {
  const cls = "rounded-lg border-2 border-black bg-white px-2 py-1.5 text-sm text-ink outline-none";
  return (
    <label className="flex flex-col gap-1 text-left">
      <span className="text-xs font-semibold text-muted">{label}</span>
      {multiline ? (
        <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={2} className={`resize-none ${cls}`} />
      ) : (
        <input value={value} onChange={(e) => onChange(e.target.value)} className={cls} />
      )}
    </label>
  );
}

function EditForm({
  card,
  onDone,
  onCancel,
  onUploadImage,
  onGenerateImage,
}: {
  card: SrsCardData;
  onDone: (patch: Partial<Card>) => void;
  onCancel: () => void;
  onUploadImage?: (file: File) => void;
  onGenerateImage?: () => Promise<void> | void;
}) {
  const { t } = usePrefs();
  const c = splitCloze(card.sentence);
  const [f, setF] = useState({
    word: card.headword,
    ipa: card.ipa,
    pos: card.pos,
    forms: card.forms.join(", "),
    translation: card.meaning,
    explanation: card.explanation ?? "",
    example: c.before + card.headword + c.after,
    collocations: card.collocations.join(", "),
    personalNote: card.personalNote,
  });
  const [generating, setGenerating] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const set = (k: keyof typeof f) => (v: string) => setF((prev) => ({ ...prev, [k]: v }));

  function done() {
    onDone({
      word: f.word,
      ipa: f.ipa,
      pos: f.pos,
      forms: parseList(f.forms),
      translation: f.translation,
      explanation: f.explanation,
      example: f.example,
      sentence: deriveCloze(f.example, f.word),
      collocations: parseList(f.collocations),
      personalNote: f.personalNote,
    });
  }

  async function generate() {
    setGenerating(true);
    try {
      await onGenerateImage?.();
    } catch (err) {
      console.error("Failed to generate image", err);
    } finally {
      setGenerating(false);
    }
  }

  const btn = "rounded-xl border-2 border-black bg-white px-3 py-2 text-sm font-semibold text-ink shadow-toon-sm disabled:opacity-50";

  return (
    <div className="mx-auto flex h-[560px] w-full max-w-sm flex-col overflow-y-auto rounded-[18px] border-2 border-black bg-surface p-5 shadow-toon">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted">{t("edit")}</span>
        <button type="button" onClick={onCancel} className="text-sm font-semibold text-accent">
          {t("cancel")}
        </button>
      </div>

      <div className="flex flex-col gap-3">
        <Field label={t("fieldWord")} value={f.word} onChange={set("word")} />
        <Field label={t("fieldIpa")} value={f.ipa} onChange={set("ipa")} />
        <Field label={t("fieldExample")} value={f.example} onChange={set("example")} multiline />
        <Field label={t("fieldTranslation")} value={f.translation} onChange={set("translation")} />
        <Field label={t("fieldExplanation")} value={f.explanation} onChange={set("explanation")} multiline />
        <Field label={t("fieldPos")} value={f.pos} onChange={set("pos")} />
        <Field label={t("fieldForms")} value={f.forms} onChange={set("forms")} />
        <Field label={t("fieldCollocations")} value={f.collocations} onChange={set("collocations")} />
        <Field label={t("fieldNote")} value={f.personalNote} onChange={set("personalNote")} multiline />

        <div>
          <p className="mb-1 text-xs font-semibold text-muted">{t("editImage")}</p>
          {card.imageUrl && (
            <img
              src={card.imageUrl}
              alt=""
              className="mb-2 max-h-40 w-auto max-w-full rounded-xl border-2 border-black object-contain"
              onError={(e) => (e.currentTarget.style.display = "none")}
            />
          )}
          <div className="flex gap-2">
            <button type="button" onClick={() => fileRef.current?.click()} className={btn}>
              {t("uploadPhoto")}
            </button>
            {onGenerateImage && (
              <button type="button" onClick={generate} disabled={generating} className={btn}>
                {generating ? t("generating") : t("generatePhoto")}
              </button>
            )}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onUploadImage?.(file);
              e.currentTarget.value = "";
            }}
          />
        </div>
      </div>

      <button
        type="button"
        onClick={done}
        className="mt-4 rounded-2xl border-2 border-black bg-mint px-4 py-2.5 text-sm font-semibold text-ink shadow-toon-sm"
      >
        {t("save")}
      </button>
    </div>
  );
}
