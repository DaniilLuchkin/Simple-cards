import { useState } from "react";
import { motion, useAnimation } from "framer-motion";
import type { Card, Deck, DeckFilter } from "../lib/api";
import { api } from "../lib/api";
import { usePrefs } from "../lib/prefs";
import { haptic } from "../lib/telegram";
import { inDeck, withCounts, generalCount } from "../lib/decks";
import { CardDetail } from "./CardDetail";
import { DeckChips } from "./DeckChips";
import { DeckPickerSheet } from "./DeckPickerSheet";

const DELETE_THRESHOLD = 90;

export function Library({
  cards,
  decks,
  learningLang,
  onCardUpdated,
  onCardDeleted,
  onCreateDeck,
  onRenameDeck,
  onDeleteDeck,
  onMoveCards,
}: {
  cards: Card[];
  decks: Deck[];
  learningLang: string;
  onCardUpdated: (card: Card) => void;
  onCardDeleted: (cardId: string) => void;
  onCreateDeck: (name: string) => Promise<Deck>;
  onRenameDeck: (id: string, name: string) => Promise<void>;
  onDeleteDeck: (id: string) => Promise<void>;
  /** Files a batch of existing cards into a deck; null = the general deck. */
  onMoveCards: (cardIds: string[], deckId: string | null) => Promise<void>;
}) {
  const { t } = usePrefs();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectMode, setSelectMode] = useState(false);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  // Which deck the list is filtered to: undefined = every card.
  const [deckId, setDeckId] = useState<DeckFilter>(undefined);
  // Deck being renamed/deleted after a long press, and the "new deck" prompt.
  const [managed, setManaged] = useState<Deck | null>(null);
  const [naming, setNaming] = useState(false);
  // Open deck picker for the checked cards.
  const [movingTo, setMovingTo] = useState(false);
  const selectedCard = cards.find((c) => c.id === selectedId) ?? null;
  const shown = inDeck(cards, deckId);
  const deckList = withCounts(decks, cards);

  async function createDeck(name: string) {
    const deck = await onCreateDeck(name);
    setNaming(false);
    setDeckId(deck.id);
  }

  async function removeDeck(id: string) {
    await onDeleteDeck(id);
    setManaged(null);
    // Its cards are still there, under the general deck - land the user where
    // they can see they survived.
    if (deckId === id) setDeckId(undefined);
  }

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

  // Everything currently on screen, i.e. within the deck filter - so "sort the
  // general pile" is: filter to it, select all, move.
  function toggleAllShown() {
    setChecked((prev) => (prev.size === shown.length ? new Set() : new Set(shown.map((c) => c.id))));
  }

  async function deleteChecked() {
    setBusy(true);
    const ids = [...checked];
    for (const id of ids) await deleteCard(id);
    setChecked(new Set());
    setSelectMode(false);
    setBusy(false);
  }

  async function moveChecked(value: string) {
    setBusy(true);
    try {
      await onMoveCards([...checked], value === "none" ? null : value);
      setMovingTo(false);
      setChecked(new Set());
      setSelectMode(false);
    } catch (err) {
      console.error("Failed to move cards", err);
    } finally {
      setBusy(false);
    }
  }

  function exitSelect() {
    setSelectMode(false);
    setChecked(new Set());
  }

  if (cards.length === 0 && decks.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-center text-sm text-oncanvas opacity-70">
        {t("libEmpty")}
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <DeckChips
        decks={deckList}
        generalCount={generalCount(cards, 0)}
        value={deckId}
        showAll
        showCounts
        onChange={setDeckId}
        onAdd={() => setNaming(true)}
        onManage={setManaged}
      />

      <div className="flex items-center justify-between px-1 pb-2 text-oncanvas">
        <span className="text-xs opacity-70">
          {selectMode ? `${checked.size} ${t("selected")}` : t("swipeToDelete")}
        </span>
        {selectMode ? (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={toggleAllShown}
              className="rounded-full border-2 border-black bg-white px-3 py-1 text-sm font-semibold text-ink shadow-toon-sm"
            >
              {checked.size === shown.length ? t("aiClearSel") : t("aiSelectAll")}
            </button>
            <button
              type="button"
              onClick={exitSelect}
              className="rounded-full border-2 border-black bg-white px-3 py-1 text-sm font-semibold text-ink shadow-toon-sm"
            >
              {t("cancel")}
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setSelectMode(true)}
            className="rounded-full border-2 border-black bg-white px-3 py-1 text-sm font-semibold text-ink shadow-toon-sm"
          >
            {t("select")}
          </button>
        )}
      </div>

      <div
        className="no-scrollbar -mx-2 flex flex-1 flex-col gap-3 overflow-y-auto px-2 pb-8 pt-3"
        style={{
          maskImage:
            "linear-gradient(to bottom, transparent 0, #000 16px, #000 calc(100% - 16px), transparent 100%)",
          WebkitMaskImage:
            "linear-gradient(to bottom, transparent 0, #000 16px, #000 calc(100% - 16px), transparent 100%)",
        }}
      >
        {shown.length === 0 && (
          <p className="py-10 text-center text-sm text-oncanvas opacity-70">{t("libEmpty")}</p>
        )}
        {shown.map((card) => (
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

      {/* Bulk actions sit at the bottom, in thumb reach. */}
      {selectMode && (
        <div className="flex gap-2 pb-1 pt-1">
          <button
            type="button"
            disabled={busy || checked.size === 0}
            onClick={() => setMovingTo(true)}
            className="flex-1 rounded-2xl border-2 border-black bg-sky px-4 py-2.5 text-sm font-semibold text-ink shadow-toon-sm disabled:opacity-50"
          >
            🗂 {t("moveToDeck")}
          </button>
          <button
            type="button"
            disabled={busy || checked.size === 0}
            onClick={deleteChecked}
            className="rounded-2xl border-2 border-black bg-rose-400 px-4 py-2.5 text-sm font-semibold text-ink shadow-toon-sm disabled:opacity-50"
          >
            {t("delete")}
          </button>
        </div>
      )}

      {movingTo && (
        <DeckPickerSheet
          decks={deckList}
          value={deckId && deckId !== "none" ? deckId : "none"}
          title={`${t("moveToDeckTitle")} · ${checked.size}`}
          onCreate={onCreateDeck}
          onConfirm={moveChecked}
          onCancel={() => setMovingTo(false)}
        />
      )}

      {selectedCard && (
        <CardDetail
          card={selectedCard}
          decks={decks}
          learningLang={learningLang}
          onClose={() => setSelectedId(null)}
          onUpdated={onCardUpdated}
          onDeleted={onCardDeleted}
        />
      )}

      {naming && (
        <DeckNamePrompt
          title={t("deckNew")}
          onSubmit={createDeck}
          onCancel={() => setNaming(false)}
        />
      )}

      {managed && !naming && (
        <DeckManageSheet
          deck={managed}
          onRename={(name) => onRenameDeck(managed.id, name).then(() => setManaged(null))}
          onDelete={() => removeDeck(managed.id)}
          onCancel={() => setManaged(null)}
        />
      )}
    </div>
  );
}

// Name entry for creating or renaming a deck.
function DeckNamePrompt({
  title,
  initial = "",
  onSubmit,
  onCancel,
}: {
  title: string;
  initial?: string;
  onSubmit: (name: string) => Promise<void>;
  onCancel: () => void;
}) {
  const { t } = usePrefs();
  const [name, setName] = useState(initial);
  const [busy, setBusy] = useState(false);

  async function submit() {
    const trimmed = name.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    try {
      await onSubmit(trimmed);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center">
      <div className="w-full max-w-sm rounded-[18px] border-2 border-black bg-surface p-5 shadow-toon-lg">
        <h3 className="mb-3 text-base font-bold text-ink">{title}</h3>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder={t("deckName")}
          maxLength={60}
          className="w-full rounded-2xl border-2 border-black bg-white px-3 py-2 text-base text-ink outline-none placeholder:text-muted"
        />
        <button
          type="button"
          onClick={submit}
          disabled={!name.trim() || busy}
          className="mt-4 w-full rounded-2xl border-2 border-black bg-mint px-4 py-2.5 text-sm font-semibold text-ink shadow-toon-sm disabled:opacity-50"
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

// Rename or delete, reached by pressing and holding a deck chip.
function DeckManageSheet({
  deck,
  onRename,
  onDelete,
  onCancel,
}: {
  deck: Deck;
  onRename: (name: string) => Promise<void>;
  onDelete: () => Promise<void>;
  onCancel: () => void;
}) {
  const { t } = usePrefs();
  const [renaming, setRenaming] = useState(false);
  const [confirming, setConfirming] = useState(false);

  if (renaming) {
    return <DeckNamePrompt title={t("deckRename")} initial={deck.name} onSubmit={onRename} onCancel={onCancel} />;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center">
      <div className="w-full max-w-sm rounded-[18px] border-2 border-black bg-surface p-5 shadow-toon-lg">
        <h3 className="mb-3 text-base font-bold text-ink">{deck.name}</h3>
        {confirming ? (
          <>
            <p className="mb-4 text-sm text-muted">{t("deckDeleteConfirm")}</p>
            <button
              type="button"
              onClick={onDelete}
              className="w-full rounded-2xl border-2 border-black bg-rose-400 px-4 py-2.5 text-sm font-semibold text-ink shadow-toon-sm"
            >
              {t("delete")}
            </button>
          </>
        ) : (
          <div className="flex flex-col gap-3">
            <button
              type="button"
              onClick={() => setRenaming(true)}
              className="w-full rounded-2xl border-2 border-black bg-white px-4 py-2.5 text-sm font-semibold text-ink shadow-toon-sm"
            >
              {t("deckRename")}
            </button>
            <button
              type="button"
              onClick={() => setConfirming(true)}
              className="w-full rounded-2xl border-2 border-black bg-rose-400 px-4 py-2.5 text-sm font-semibold text-ink shadow-toon-sm"
            >
              {t("deckDelete")}
            </button>
          </div>
        )}
        <button type="button" onClick={onCancel} className="mt-3 w-full text-center text-sm text-muted">
          {t("cancel")}
        </button>
      </div>
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
