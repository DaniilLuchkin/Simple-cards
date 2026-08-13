import { motion } from "framer-motion";

const COLORS = ["#7ED8B2", "#FFD9C2", "#CFE6FF", "#F5C6D6", "#FFE9A8"];

// Lightweight celebratory burst for the session summary - plain divs animated
// by framer-motion (already a dependency), no canvas or extra library.
export function Confetti({ pieces = 28 }: { pieces?: number }) {
  // Deterministic-ish spread so the burst looks even rather than clumped.
  const bits = Array.from({ length: pieces }, (_, i) => {
    const angle = (i / pieces) * Math.PI * 2;
    return {
      id: i,
      x: Math.cos(angle) * (60 + (i % 5) * 22),
      y: Math.sin(angle) * (50 + (i % 4) * 20) - 40,
      rotate: (i % 2 ? 1 : -1) * (120 + i * 13),
      color: COLORS[i % COLORS.length],
      delay: (i % 6) * 0.03,
    };
  });

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden">
      {bits.map((b) => (
        <motion.span
          key={b.id}
          initial={{ opacity: 1, x: 0, y: 0, scale: 0.6, rotate: 0 }}
          animate={{ opacity: 0, x: b.x, y: b.y + 140, scale: 1, rotate: b.rotate }}
          transition={{ duration: 1.5, delay: b.delay, ease: "easeOut" }}
          style={{ backgroundColor: b.color }}
          className="absolute h-2.5 w-2 rounded-[2px] border border-black/20"
        />
      ))}
    </div>
  );
}
