import { motion, useAnimation, useMotionValue, useTransform } from "framer-motion";
import type { MotionValue } from "framer-motion";
import { useState } from "react";
import type { Card } from "../lib/api";
import { FlipCard } from "./CardView";
import { haptic } from "../lib/telegram";

const SWIPE_THRESHOLD = 120;

export function SwipeCard({
  card,
  active,
  dragX,
  onSwiped,
}: {
  card: Card;
  active: boolean;
  // Provided for the top card so the stack can render drag feedback.
  dragX?: MotionValue<number>;
  onSwiped: (direction: "left" | "right") => void;
}) {
  const [flipped, setFlipped] = useState(false);
  const controls = useAnimation();
  const localX = useMotionValue(0);
  const x = dragX ?? localX;
  const rotate = useTransform(x, [-300, 300], [-18, 18]);

  async function handleDragEnd(_: unknown, info: { offset: { x: number } }) {
    if (!active) return;
    if (info.offset.x > SWIPE_THRESHOLD) {
      haptic("medium");
      await controls.start({ x: 600, rotate: 20, opacity: 0, transition: { duration: 0.25 } });
      onSwiped("right");
    } else if (info.offset.x < -SWIPE_THRESHOLD) {
      haptic("medium");
      await controls.start({ x: -600, rotate: -20, opacity: 0, transition: { duration: 0.25 } });
      onSwiped("left");
    } else {
      controls.start({ x: 0, rotate: 0, transition: { type: "spring", stiffness: 300, damping: 24 } });
    }
  }

  return (
    <motion.div
      className="absolute inset-0 mx-auto h-full max-w-sm cursor-grab touch-none select-none active:cursor-grabbing"
      style={{ x, rotate }}
      animate={controls}
      drag={active ? "x" : false}
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={1}
      onDragEnd={handleDragEnd}
      onTap={(event) => {
        if (!active) return;
        // Taps on the translation-reveal button must not flip the card.
        if ((event.target as HTMLElement | null)?.closest("[data-no-flip]")) return;
        setFlipped((f) => !f);
      }}
    >
      <FlipCard card={card} flipped={flipped} />
    </motion.div>
  );
}
