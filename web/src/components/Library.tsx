import { useState } from "react";
import { motion, useAnimation } from "framer-motion";
import type { Card } from "../lib/api";
import { api } from "../lib/api";
import { usePrefs } from "../lib/prefs";
import { haptic } from "../lib/telegram";
import { CardDetail } from "./CardDetail";

const DELETE_THRESHOLD = 90;

export function Library({
  cards,
  learningLang,
  onCardUpdated,
  onCardDeleted,
}: {
  cards: Card[];
  learningLang: string;
  onCardUpdated: (card: Card) => void;
  onCardDeleted: (cardId: string) => void;
}) {
  const { t } = usePrefs();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectMode, setSelectMode] = useState(false);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const selectedCard = cards.find((c) => c.id === selectedId) ?? null;

  async function deleteCard(id: string) {
    try {
      await api.deleteCard(id);
      onCardDeleted(id);
    } catch (err) {
      console.error("Failed to delete card", err);
    }
  }

  function toggleChecked(id: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function deleteChecked() {
    setBusy(true);
    const ids = [...checked];
    for (const id of ids) await deleteCard(id);
    setChecked(new Set());
    setSelectMode(false);
    setBusy(false);
  }

  function exitSelect() {
    setSelectMode(false);
    setChecked(new Set());
  }

  if (cards.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-center text-sm text-oncanvas opacity-70">
        {t("libEmpty")}
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-1 pb-2 text-oncanvas">
        <span className="text-xs opacity-70">
          {selectMode ? `${checked.size} ${t("selected")}` : t("swipeToDelete")}
        </span>
        {selectMode ? (
          <div className="flex gap-2">
            <button type="button" onClick={exitSelect} className="text-sm opacity-70">
              {t("cancel")}
            </button>
            <button
              type="button"
              disabled={busy || checked.size === 0}
              onClick={deleteChecked}
              className="text-sm font-semibold text-rose-500 disabled:opacity-40"
            >
              {t("deleteSelected")}
            </button>
          </div>
        ) : (
          <button type="button" onClick={() => setSelectMode(true)} className="text-sm font-semibold">
            {t("select")}
          </button>
        )}
      </div>

      <div className="-mx-2 flex flex-1 flex-col gap-3 overflow-y-auto px-2 pb-6 pt-1">
        {cards.map((card) => (
          <LibraryRow
            key={card.id}
            card={card}
            selectMode={selectMode}
            checked={checked.has(card.id)}
            onOpen={() => (selectMode ? toggleChecked(card.id) : setSelectedId(card.id))}
            onDelete={() => deleteCard(card.id)}
          />
        ))}
      </div>

      {selectedCard && (
        <CardDetail
          card={selectedCard}
          learningLang={learningLang}
          onClose={() => setSelectedId(null)}
          onUpdated={onCardUpdated}
          onDeleted={onCardDeleted}
        />
      )}
    </div>
  );
}

function LibraryRow({
  card,
  selectMode,
  checked,
  onOpen,
  onDelete,
}: {
  card: Card;
  selectMode: boolean;
  checked: boolean;
  onOpen: () => void;
  onDelete: () => void;
}) {
  const { t, uiLang } = usePrefs();
  const controls = useAnimation();

  async function handleDragEnd(_: unknown, info: { offset: { x: number } }) {
    if (info.offset.x < -DELETE_THRESHOLD) {
      haptic("medium");
      await controls.start({ x: -400, opacity: 0, transition: { duration: 0.2 } });
      onDelete();
    } else {
      controls.start({ x: 0, transition: { type: "spring", stiffness: 300, damping: 26 } });
    }
  }

  return (
    <div className="relative">
      {/* Red "delete" backdrop revealed as the row slides left. */}
      <div className="absolute inset-0 flex items-center justify-end rounded-2xl border-2 border-black bg-rose-500 pr-5 text-sm font-bold text-white">
        {t("delete")}
      </div>

      <motion.button
        type="button"
        onClick={onOpen}
        animate={controls}
        drag={selectMode ? false : "x"}
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={{ left: 0.7, right: 0 }}
        onDragEnd={handleDragEnd}
        className="relative flex w-full items-center gap-3 rounded-2xl border-2 border-black bg-surface p-4 text-left shadow-toon-sm"
      >
        {selectMode && (
          <span
            className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-black ${
              checked ? "bg-emerald-400 text-ink" : "bg-white text-transparent"
            }`}
          >
            ✓
          </span>
        )}
        {card.imageUrl && (
          <img
            src={card.imageUrl}
            alt=""
            className="h-14 w-14 shrink-0 rounded-xl border-2 border-black object-cover"
            onError={(e) => (e.currentTarget.style.display = "none")}
          />
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-semibold text-ink">{card.word}</p>
          <p className="truncate text-sm text-muted">{card.example}</p>
          <p className="mt-1 text-xs text-muted/70">
            {t("nextReview")}: {new Date(card.dueAt).toLocaleDateString(uiLang)}
          </p>
        </div>
        {!selectMode && <span className="shrink-0 text-muted/60">›</span>}
      </motion.button>
    </div>
  );
}
