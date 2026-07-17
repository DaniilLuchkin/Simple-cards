import { initialSrsState } from "../lib/srs";
import type { SrsCard } from "../lib/srsCard";

// A small, meaning-bearing image: a cloud with light, sparse rain — the sense
// of "drizzle". Inline SVG data URI so the demo is self-contained (works in the
// Telegram webview and in offline screenshots).
const drizzleImage =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">
      <rect width="120" height="120" fill="#dCE7F1"/>
      <g fill="#9fb3c8">
        <path d="M38 54a16 16 0 0 1 31-5 13 13 0 0 1 17 12 11 11 0 0 1-2 22H42a14 14 0 0 1-4-27z"/>
      </g>
      <g stroke="#5C6B7A" stroke-width="3" stroke-linecap="round" opacity="0.7">
        <line x1="46" y1="86" x2="42" y2="98"/>
        <line x1="62" y1="86" x2="58" y2="98"/>
        <line x1="78" y1="86" x2="74" y2="98"/>
        <line x1="54" y1="92" x2="51" y2="102"/>
        <line x1="70" y1="92" x2="67" y2="102"/>
      </g>
    </svg>`
  );

// Mock card from the spec. One sense only — "morning light rain".
export const drizzleCard: SrsCard = {
  id: "drizzle",
  headword: "drizzle",
  ipa: "/ˈdrɪz.əl/",
  pos: "глагол",
  forms: ["drizzled", "drizzling"],
  meaning: "моросить — идёт мелкий, лёгкий дождь",
  explanation: "to rain lightly, in very small drops",
  sentence: "It's starting to {{gap}} again — classic Vancouver morning.",
  collocations: ["began to drizzle", "it drizzled all afternoon", "drizzle on and off"],
  imageUrl: drizzleImage,
  icon: "🌧️",
  personalNote: "",
  srs: initialSrsState(),
};
