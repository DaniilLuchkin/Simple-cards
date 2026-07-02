import { motion, useAnimation, useMotionValue, useTransform } from "framer-motion";
import { useState } from "react";
import type { Card } from "../lib/api";
import { FlipCard } from "./CardView";
import { haptic } from "../lib/telegram";

const SWIPE_THRESHOLD = 120;

export function SwipeCard({
  card,
  active,
  onSwiped,
}: {
  card: Card;
  active: boolean;
  onSwiped: (direction: "left" | "right") => void;
}) {
  const [flipped, setFlipped] = useState(false);
  const controls = useAnimation();
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-300, 300], [-18, 18]);
  const rememberOpacity = useTransform(x, [20, 140], [0, 1]);
  const forgotOpacity = useTransform(x, [-140, -20], [1, 0]);

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
      onTap={() => active && setFlipped((f) => !f)}
    >
      <FlipCard card={card} flipped={flipped} />

      <motion.div
        style={{ opacity: rememberOpacity }}
        className="pointer-events-none absolute right-6 top-6 rotate-12 rounded-xl border-2 border-mint bg-white/80 px-4 py-1.5 text-sm font-bold uppercase tracking-wide text-mint"
      >
        Помню
      </motion.div>
      <motion.div
        style={{ opacity: forgotOpacity }}
        className="pointer-events-none absolute left-6 top-6 -rotate-12 rounded-xl border-2 border-blush bg-white/80 px-4 py-1.5 text-sm font-bold uppercase tracking-wide text-blush"
      >
        Забыл
      </motion.div>
    </motion.div>
  );
}
