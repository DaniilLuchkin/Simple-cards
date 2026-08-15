import { useRef } from "react";
import type { MouseEvent } from "react";
import { haptic } from "./telegram";

// Deliberate press-and-hold (500ms + haptic). Returns handlers to spread on the
// target so a stray tap never triggers it.
//
// Callers that ALSO handle a plain click on the same element must swallow the
// click that follows a completed hold (see the `suppressClick` ref pattern in
// SrsCard/GrammarSession), otherwise one gesture fires both actions.
export function useLongPress(onTrigger: () => void) {
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
