import { useRef } from "react";
import type { Deck } from "../lib/api";
import { usePrefs } from "../lib/prefs";
import { useLongPress } from "../lib/useLongPress";

/**
 * Deck selection as a scrolling chip row. `value` is the same shape the API
 * takes: undefined = every card, "none" = the general deck, else a deck id.
 *
 * Shared by the Library filter, the lobby study picker and the save sheet;
 * `showAll` and `onAdd`/`onManage` decide which extras appear.
 */
export function DeckChips({
  decks,
  generalCount,
  value,
  showAll = false,
  showCounts = false,
  onChange,
  onAdd,
  onManage,
}: {
  decks: Deck[];
  generalCount?: number;
  value: string | undefined;
  /** Offer an "all cards" chip (the study/filter case, not the save case). */
  showAll?: boolean;
  showCounts?: boolean;
  onChange: (value: string | undefined) => void;
  onAdd?: () => void;
  /** Press-and-hold a real deck to rename or delete it. */
  onManage?: (deck: Deck) => void;
}) {
  const { t } = usePrefs();

  const chip = (active: boolean) =>
    `shrink-0 rounded-full border-2 px-3 py-1 text-[13px] font-semibold transition ${
      active ? "border-black bg-sky text-ink shadow-toon-sm" : "border-black/30 bg-white text-muted"
    }`;

  return (
    <div className="no-scrollbar -mx-2 flex items-center gap-1.5 overflow-x-auto px-2 py-1">
      {showAll && (
        <button type="button" onClick={() => onChange(undefined)} className={chip(value === undefined)}>
          {t("deckAll")}
        </button>
      )}

      <button type="button" onClick={() => onChange("none")} className={chip(value === "none")}>
        {t("deckGeneral")}
        {showCounts && generalCount !== undefined && (
          <span className="ml-1 opacity-60">{generalCount}</span>
        )}
      </button>

      {decks.map((deck) => (
        <DeckChip
          key={deck.id}
          deck={deck}
          active={value === deck.id}
          showCount={showCounts}
          className={chip(value === deck.id)}
          onSelect={() => onChange(deck.id)}
          onManage={onManage}
        />
      ))}

      {onAdd && (
        <button
          type="button"
          onClick={onAdd}
          aria-label={t("deckNew")}
          className="shrink-0 rounded-full border-2 border-dashed border-black px-3 py-1 text-[13px] font-bold text-ink"
        >
          ＋
        </button>
      )}
    </div>
  );
}

function DeckChip({
  deck,
  showCount,
  className,
  onSelect,
  onManage,
}: {
  deck: Deck;
  active: boolean;
  showCount: boolean;
  className: string;
  onSelect: () => void;
  onManage?: (deck: Deck) => void;
}) {
  // Hold to manage; the click that follows a completed hold is swallowed so one
  // gesture doesn't both open the menu and switch decks.
  const held = useRef(false);
  const hold = useLongPress(() => {
    if (!onManage) return;
    held.current = true;
    onManage(deck);
  });

  return (
    <button
      type="button"
      onClick={() => {
        if (held.current) {
          held.current = false;
          return;
        }
        onSelect();
      }}
      {...(onManage ? hold : {})}
      className={className}
    >
      {deck.name}
      {showCount && <span className="ml-1 opacity-60">{deck.cardCount}</span>}
    </button>
  );
}
