import React, { useState } from "react";
import ReactDOM from "react-dom/client";
import { PrefsProvider } from "./lib/prefs";
import { SrsCard } from "./components/srs/SrsCard";
import { drizzleCard } from "./data/drizzle";
import { validateSrsCard } from "./lib/srsCard";
import type { Grade } from "./lib/srs";
import "./styles/index.css";

// Honor ?theme=dark before the app reads its saved theme.
const params = new URLSearchParams(location.search);
if (params.get("theme") === "dark") localStorage.setItem("theme", "dark");

// Demonstrate the minimum-information validator: a good card passes, a
// multi-sense card is flagged.
console.log("drizzle validation:", validateSrsCard(drizzleCard));
console.log(
  "bad card validation:",
  validateSrsCard({ ...drizzleCard, meaning: "моросить; изморось; сбрызгивать (кулин.)" })
);

function Demo() {
  const [card, setCard] = useState(drizzleCard);
  const [log, setLog] = useState<string>("");

  function handleGrade(grade: Grade, next: { interval: number }) {
    setLog(`graded "${grade}" → next interval ${next.interval}d`);
  }

  return (
    <div className="mx-auto max-w-md px-4 py-6">
      <h1 className="mb-4 text-center text-lg font-semibold text-ink">SRS Card — drizzle</h1>
      <div className="flex flex-col gap-8">
        <SrsCard card={card} learningLang="en-US" onGrade={handleGrade} onEdit={() => {}} />
        <SrsCard
          card={card}
          learningLang="en-US"
          defaultFlipped
          onGrade={handleGrade}
          onEdit={(patch) =>
            setCard((c) => ({ ...c, personalNote: patch.personalNote ?? c.personalNote }))
          }
        />
      </div>
      {log && <p className="mt-4 text-center text-sm text-muted">{log}</p>}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <PrefsProvider>
      <Demo />
    </PrefsProvider>
  </React.StrictMode>
);
